"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { writeAudit } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { isPortalDocumentKind } from "@/lib/portal/documents";
import { site } from "@/lib/site";
import {
  checkRateLimit,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateUploads } from "@/lib/validators/files";
import {
  GENERIC_ERROR,
  RATE_LIMIT_ERROR,
  submittedValues,
  type DownloadState,
  type FormState,
} from "./types";

const BUCKET = "claim-docs";

/** Spec §7.5. Long enough to click and download, short enough to be useless if forwarded. */
const SIGNED_URL_TTL_SECONDS = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_YOURS =
  "That file is not on your claim, or it is no longer there.";

/**
 * Upload lands in two systems that can disagree, so the order is chosen to make
 * the survivable failure the one that happens: bytes first through the service
 * role — `storage.objects` carries no policy for `authenticated`, deliberately
 * — then the `documents` row through the *caller's* client, so
 * `documents_insert` is what authorises it.
 *
 * If the row is refused, the object is removed again. The reverse order would
 * leave a row pointing at bytes that were never written, which is a broken
 * download for every reader from then on. An orphaned object is invisible and
 * sweepable; an orphaned row is a lie on the page.
 *
 * `visibility` is fixed at `customer` and never read from the form. It is the
 * only value the policy admits from a homeowner, and it is also the honest one:
 * a person uploading a photo of their own ceiling should be able to see it
 * afterwards, and a file they cannot see is a file they will upload twice.
 */
export async function uploadPortalDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole("customer");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "");
  /* `files` is absent by construction: `submittedValues` takes strings only,
     and no page may set a file input's value. The dropdown is the part that can
     be handed back, and it is worth handing back — a reset that silently
     returned "Photo of the damage" to the top of the list after a refusal makes
     the person re-answer a question they already answered. */
  const typed = submittedValues(formData, ["kind"]);

  if (!(await checkRateLimit(RATE_LIMITS.portalUploadUser, session.userId))) {
    return { status: "error", message: RATE_LIMIT_ERROR, values: typed };
  }

  if (!isPortalDocumentKind(kindRaw)) {
    return {
      status: "error",
      fieldErrors: { kind: "Tell us what this file is." },
      message: "Check the highlighted field and try again.",
      values: typed,
    };
  }

  if (!UUID.test(claimId)) {
    return { status: "error", message: NOT_YOURS, values: typed };
  }

  const supabase = await createClient();

  // The read is the access check: `claims_select` scopes a customer to the
  // claims they are a claimant on, so somebody else's claim is indistinguishable
  // from a missing one here.
  const { data: claim } = await supabase
    .from("claims")
    .select("id, claim_ref")
    .eq("id", claimId)
    .maybeSingle();

  if (!claim) return { status: "error", message: NOT_YOURS, values: typed };

  // The same allowlist the public intake enforces — mime, 25 MB, 10 files —
  // because it is the same bucket, the same CHECK constraints and the same
  // `documents_mime_allowlist` underneath. One module, so the two surfaces
  // cannot come to disagree about what a homeowner may send.
  const validation = validateUploads(formData.getAll("files"));
  if (!validation.ok) {
    return { status: "error", message: validation.message, values: typed };
  }
  if (validation.files.length === 0) {
    return {
      status: "error",
      fieldErrors: { files: "Choose a file to send." },
      message: "Check the highlighted field and try again.",
      values: typed,
    };
  }

  const admin = createAdminClient();
  const stored: string[] = [];

  for (const upload of validation.files) {
    // UUID filename, never the uploaded one (spec §7.4).
    // `documents_storage_path_matches_claim` requires exactly this prefix.
    const path = `claims/${claimId}/${randomUUID()}.${upload.extension}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, upload.file, { contentType: upload.mime, upsert: false });

    if (uploadError) {
      console.error("[portal] object upload failed", uploadError.message);
      await admin.storage.from(BUCKET).remove(stored);
      return { status: "error", message: GENERIC_ERROR, values: typed };
    }

    stored.push(path);

    const { data: row, error: rowError } = await supabase
      .from("documents")
      .insert({
        claim_id: claimId,
        storage_path: path,
        original_name: upload.originalName,
        kind: kindRaw,
        mime: upload.mime,
        size_bytes: upload.size,
        uploaded_by: session.userId,
        visibility: "customer",
      })
      .select("id");

    if (rowError || (row?.length ?? 0) === 0) {
      if (rowError) console.error("[portal] row insert failed", rowError.message);
      await admin.storage.from(BUCKET).remove(stored);
      return { status: "error", message: GENERIC_ERROR, values: typed };
    }
  }

  revalidatePath(`/portal/claims/${claimId}/documents`);

  return {
    status: "success",
    message:
      validation.files.length === 1
        ? "Sent. Your adjuster can see it now."
        : `${validation.files.length} files sent. Your adjuster can see them now.`,
  };
}

/**
 * A download is an authorization decision followed by a URL mint, in that order
 * and never fused.
 *
 * The decision is made by reading the `documents` row through the caller's own
 * client. For a homeowner `documents_select` is `visibility = 'customer' and
 * private.is_claim_customer(claim_id)`, so an internal document on their own
 * claim and any document on somebody else's both read zero rows and are refused
 * with the same sentence a nonexistent id gets.
 *
 * Only then does the service-role client mint the URL, and it has to be that
 * client: `storage.objects` carries no policy for `authenticated` at all — a
 * policy there would let bytes be pulled with no authz check and no audit entry,
 * which is precisely the property this two-step exists to keep. This and the
 * audit write are the only service-role calls on the portal.
 *
 * `download: <original name>` is what puts `Content-Disposition: attachment` on
 * the storage response. Without it an uploaded PDF, SVG or HTML renders inline;
 * the bucket is not on the app's origin, but a document that opens in a tab is
 * still a document that can be framed and mistaken for the app.
 */
export async function issuePortalDownload(
  _previous: DownloadState,
  formData: FormData,
): Promise<DownloadState> {
  const session = await requireRole("customer");
  const documentId = String(formData.get("documentId") ?? "").trim();

  if (!UUID.test(documentId)) {
    return { status: "error", message: NOT_YOURS };
  }

  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, claim_id, storage_path, original_name, kind, visibility")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !document) {
    return { status: "error", message: NOT_YOURS };
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: document.original_name,
    });

  if (signError || !signed?.signedUrl) {
    console.error("[portal] signed url failed", signError?.message);
    /* Not `GENERIC_ERROR`. That sentence is written for a submission — "We
       could not submit that just now… call us and we'll take the details over
       the phone" — and this is the one control on the surface that submits
       nothing: the homeowner asked for a file. Telling them their details could
       not be taken, about a PDF, on the screen where they are trying to read
       their own letter of representation, is an answer to a question they did
       not ask. */
    return {
      status: "error",
      message: `We could not open that file just now. Try again, and if it happens twice call us on ${site.phone} and we will email it to you.`,
    };
  }

  // Spec §7.5 / §7.7: every issuance is written to the trail, whoever asked for
  // it. The path and the TTL, never the signed URL — the URL is a bearer
  // credential for the next five minutes and `audit_log` is readable by every
  // owner. `surface` distinguishes a homeowner's download from a staff member's
  // in the one place both are recorded.
  await writeAudit(admin, {
    actorId: session.userId,
    action: "document.signed_url_issued",
    entity: "documents",
    entityId: document.id,
    meta: {
      claim_id: document.claim_id,
      storage_path: document.storage_path,
      original_name: document.original_name,
      kind: document.kind,
      visibility: document.visibility,
      ttl_seconds: SIGNED_URL_TTL_SECONDS,
      disposition: "attachment",
      surface: "portal",
    },
    ip: inetOrNull(clientIpFromHeaders(await headers())),
  });

  return {
    status: "success",
    url: signed.signedUrl,
    filename: document.original_name,
    message: `${document.original_name} is ready. The link works for 5 minutes.`,
  };
}
