"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { writeAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/authz";
import {
  isDocumentKind,
  isDocumentVisibility,
  isRepresentationKind,
} from "@/lib/claims/documents";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validateUploads } from "@/lib/validators/files";
import type { Database } from "@/types/database";
import {
  GENERIC_ERROR,
  submittedValues,
  type DownloadState,
  type FormState,
} from "./types";

const BUCKET = "claim-docs";

/** One row of the batched insert below, typed from the generated schema so a
 *  column rename cannot pass through as an untyped object literal. */
type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];

/** Spec §7.5. Long enough to click and download, short enough to be useless if forwarded. */
const SIGNED_URL_TTL_SECONDS = 300;

const NOT_YOURS =
  "That document is not available to you, or it no longer exists.";

/**
 * Upload lands in two systems and they can disagree, so the order is chosen to
 * make the survivable failure the one that happens:
 *
 *   bytes first (service role — `storage.objects` carries no policy for
 *   `authenticated`, deliberately, see …_storage.sql), then the `documents` row
 *   through the *caller's* client so `documents_insert` is what authorises it.
 *
 * If the row is refused or fails, the object is removed again. The reverse
 * order — row first — would leave a `documents` row pointing at bytes that were
 * never written, which is a broken download for every reader from then on. An
 * orphaned object is invisible and sweepable; an orphaned row is a lie on the
 * page.
 */
export async function uploadClaimDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "other");
  const visibilityRaw = String(formData.get("visibility") ?? "internal");
  /* `files` is deliberately absent: `submittedValues` takes strings only, and
     no page may set a file input's value. The two dropdowns are the part that
     can be handed back, and they are the part that matters — `visibility`
     decides whether a homeowner sees the file the moment it lands, and a reset
     that quietly returned it to "CMG only" would make the operator re-make a
     disclosure decision they had already made. */
  const typed = submittedValues(formData, ["kind", "visibility"]);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)) {
    return { status: "error", message: NOT_YOURS, values: typed };
  }

  if (!isDocumentKind(kindRaw)) {
    return {
      status: "error",
      message: "Pick what kind of document this is.",
      values: typed,
    };
  }

  if (!isDocumentVisibility(visibilityRaw)) {
    return {
      status: "error",
      message: "Pick who can see this document.",
      values: typed,
    };
  }

  const supabase = await createClient();

  // The read is the access check: `claims_select` scopes an adjuster to
  // assigned claims, so an unassigned one is indistinguishable from a missing
  // one here.
  const { data: claim } = await supabase
    .from("claims")
    .select("id, claim_ref")
    .eq("id", claimId)
    .maybeSingle();

  if (!claim) return { status: "error", message: NOT_YOURS, values: typed };

  // Both refusals are about the file field, so both name it. A form-level
  // message alone left the operator with a sentence at the foot of the form and
  // no mark on the one control they had to redo.
  const validation = validateUploads(formData.getAll("files"));
  if (!validation.ok) {
    return {
      status: "error",
      message: validation.message,
      fieldErrors: { files: validation.message },
      values: typed,
    };
  }
  if (validation.files.length === 0) {
    return {
      status: "error",
      message: "Choose a file to upload.",
      fieldErrors: { files: "Choose a file to upload." },
      values: typed,
    };
  }

  /**
   * Every object first, then one insert — the shape `submitIntake` already
   * uses, and the reason it uses it.
   *
   * This was a loop that uploaded a file, committed its row, and pushed the
   * path onto an accumulating list. Both failure branches then removed that
   * whole list while deleting no rows. Traced with three files failing on the
   * third: files one and two kept their `documents` rows and lost their bytes.
   * `issueDocumentDownload` then reads the row, mints a signed URL against an
   * object that is not there, writes `document.signed_url_issued` into the
   * audit trail, and hands the operator a link that 404s — with the record
   * asserting the file was released. `deleteClaimDocument` is the only repair,
   * and it is refused for an `lor_signed` row once the claim is past the gate.
   *
   * The header above this file states the rule this broke: an orphaned object
   * is invisible and sweepable, an orphaned row is a lie on the page. Batching
   * makes it structural rather than careful — one `insert` of N rows is one
   * statement, so it is one transaction, and on any failure at all no row can
   * have survived, which is what makes removing the whole batch correct.
   */
  const admin = createAdminClient();
  const stored: string[] = [];
  const rows: DocumentInsert[] = [];

  for (const upload of validation.files) {
    // UUID filename, never the uploaded one (spec §7.4). `documents_storage_path_matches_claim`
    // requires exactly this prefix.
    const path = `claims/${claimId}/${randomUUID()}.${upload.extension}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, upload.file, { contentType: upload.mime, upsert: false });

    if (uploadError) {
      console.error("[documents] object upload failed", uploadError.message);
      await admin.storage.from(BUCKET).remove(stored);
      return { status: "error", message: GENERIC_ERROR, values: typed };
    }

    stored.push(path);
    rows.push({
      claim_id: claimId,
      storage_path: path,
      original_name: upload.originalName,
      kind: kindRaw,
      mime: upload.mime,
      size_bytes: upload.size,
      uploaded_by: session.userId,
      visibility: visibilityRaw,
    });
  }

  const { data: inserted, error: rowError } = await supabase
    .from("documents")
    .insert(rows)
    .select("id");

  if (rowError || (inserted?.length ?? 0) !== rows.length) {
    if (rowError) console.error("[documents] row insert failed", rowError.message);
    await admin.storage.from(BUCKET).remove(stored);

    // `documents_insert` refuses `lor_unsigned` / `lor_signed` to anyone who
    // is not the owner or the assigned adjuster: those two kinds arm the
    // lor_sent → lor_signed gate, so writing one asserts that CMG holds a
    // signed letter over a homeowner.
    return {
      status: "error",
      message: isRepresentationKind(kindRaw)
        ? "Representation documents are filed by the owner or by the adjuster the claim is assigned to."
        : GENERIC_ERROR,
      values: typed,
    };
  }

  revalidatePath(`/admin/claims/${claimId}`, "layout");

  return {
    status: "success",
    message:
      validation.files.length === 1
        ? `Added to ${claim.claim_ref}.`
        : `${validation.files.length} files added to ${claim.claim_ref}.`,
  };
}

/**
 * A download is an authorization decision followed by a URL mint, in that order
 * and never fused. The decision is made by reading the `documents` row through
 * the caller's own client: `documents_select` is `is_staff_for_claim(claim_id)`
 * or the claim's customer on a customer-visible row, so an adjuster asking for
 * a document on an unassigned claim reads zero rows and is refused with the
 * same sentence a nonexistent id gets.
 *
 * Only after that does the service-role client mint the URL, and it has to be
 * that client: `storage.objects` carries no policy for `authenticated` at all
 * (…_storage.sql states the reason — a policy there would let bytes be pulled
 * with no authz check and no audit entry). This is the one place in the admin
 * surface where the service role is structurally required, and it runs strictly
 * behind a check made under RLS.
 *
 * `download: <original name>` is what puts `Content-Disposition: attachment` on
 * the storage response. Without it an uploaded PDF, SVG or HTML renders inline;
 * the bucket is not on the app's origin, but a document that opens in a tab is
 * still a document that can be framed and mistaken for the app.
 */
export async function issueDocumentDownload(
  _previous: DownloadState,
  formData: FormData,
): Promise<DownloadState> {
  const session = await requireStaff("/admin");
  const documentId = String(formData.get("documentId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
    return { status: "error", message: NOT_YOURS };
  }

  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, claim_id, storage_path, original_name, mime, kind, visibility")
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
    console.error("[documents] signed url failed", signError?.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  // Spec §7.5 / §7.7: every issuance is written to the trail. The path and the
  // TTL, never the signed URL — the URL is a bearer credential for the next
  // five minutes and `audit_log` is readable by every owner.
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
    },
    ip: inetOrNull(clientIpFromHeaders(await headers())),
  });

  return {
    status: "success",
    url: signed.signedUrl,
    filename: document.original_name,
    message: `Link ready for ${document.original_name}. It expires in 5 minutes.`,
  };
}

export async function deleteClaimDocument(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireStaff("/admin");
  const documentId = String(formData.get("documentId") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId)) {
    return { status: "error", message: NOT_YOURS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .select("id, claim_id");

  if (error) {
    console.error("[documents] delete failed", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  // `documents_delete` refuses a signed LOR once the claim has passed the gate
  // that document is the evidence for, and refuses anyone who is not the owner
  // or the assigned adjuster outright.
  if ((data?.length ?? 0) === 0) {
    return {
      status: "error",
      message:
        "That document cannot be removed. A signed letter of representation stays on the file once the claim has passed it, and documents are removed by the owner or the assigned adjuster.",
    };
  }

  // No direct storage removal here: the delete runs under the caller's own
  // client, and removing the object needs the service role, so
  // `documents_enqueue_storage_cleanup` writes the path to
  // `storage_cleanup_queue`. The protected cleanup worker removes the exact
  // queued object with bounded retries; docs/RETENTION.md records the policy and
  // the deployment-owned schedule that drives it.
  revalidatePath(`/admin/claims/${data[0].claim_id}`, "layout");
  return { status: "success", message: "Document removed." };
}
