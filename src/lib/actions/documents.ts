"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { writeAuditStrict } from "@/lib/audit";
import { requireStaff } from "@/lib/authz";
import {
  isDocumentKind,
  isDocumentVisibility,
  isRepresentationKind,
} from "@/lib/claims/documents";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDocumentStoragePath } from "@/lib/validators/storage-path";
import { registerCleanupIntent, removeOrQueueExact } from "@/lib/storage-cleanup";
import { validateUploads } from "@/lib/validators/files";
import { parsePrivateUploadManifest } from "@/lib/private-upload/manifest";
import { finalizePrivateUploadSession, privateUploadRetryMessage } from "@/lib/private-upload/finalize";
import { checkPrivateUploadFinalizeLimit, checkPrivateUploadPrepareLimit } from "@/lib/private-upload/rate-limit";
import { parsePrivateUploadCapability, preparePrivateUploadSession, privateUploadTokenHash, readPrivateUploadSession } from "@/lib/private-upload/session";
import type { PrivateFinalizeState, PrivatePrepareState } from "@/lib/private-upload/types";
import type { Database } from "@/types/database-app";
import {
  GENERIC_ERROR,
  RATE_LIMIT_ERROR,
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
 * A failed response can follow a successful row commit. Queue the exact paths
 * for the cleanup worker, which excludes objects still referenced by documents.
 * This preserves committed bytes while unused uploads remain recoverable.
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
   * Upload every object before inserting the document rows in one statement.
   * This prevents a partial row batch when a later upload fails. A lost insert
   * response can still hide a committed batch, so cleanup stays in the durable
   * queue until the worker checks document references.
   */
  const admin = createAdminClient();
  const stored: string[] = [];
  const rows: DocumentInsert[] = [];

  for (const upload of validation.files) {
    // UUID filename, never the uploaded one (spec §7.4). `documents_storage_path_matches_claim`
    // requires exactly this prefix.
    const path = `claims/${claimId}/${randomUUID()}.${upload.extension}`;
    if (!(await registerCleanupIntent(admin, BUCKET, path, claimId))) {
      await removeOrQueueExact(admin, BUCKET, stored, claimId);
      return { status: "error", message: GENERIC_ERROR, values: typed };
    }

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, upload.file, { contentType: upload.mime, upsert: false });

    if (uploadError) {
      console.error("[documents] object upload failed", uploadError.message);
      await removeOrQueueExact(admin, BUCKET, stored, claimId);
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
    await removeOrQueueExact(admin, BUCKET, stored, claimId);

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

/** Reserve exact paths and return signed Storage capabilities. Request bodies carry metadata only. */
export async function prepareClaimDocumentUpload(
  _previous: FormState,
  formData: FormData,
): Promise<PrivatePrepareState> {
  const session = await requireStaff("/admin");
  const claimId = String(formData.get("claimId") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "other");
  const visibilityRaw = String(formData.get("visibility") ?? "internal");
  const values = submittedValues(formData, ["kind", "visibility"]);
  const failure = (message: string, fieldErrors?: Record<string, string>): PrivatePrepareState => ({
    status: "error", message, values, ...(fieldErrors ? { fieldErrors } : {}),
  });

  if (!(await checkPrivateUploadPrepareLimit("staff", session.userId))) {
    return failure(RATE_LIMIT_ERROR);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)) {
    return failure(NOT_YOURS);
  }
  if (!isDocumentKind(kindRaw)) return failure("Pick what kind of document this is.", { kind: "Pick a document type." });
  if (!isDocumentVisibility(visibilityRaw)) return failure("Pick who can see this document.", { visibility: "Pick who can see this document." });
  const supabase = await createClient();
  const { data: claim } = await supabase.from("claims")
    .select("id,claim_ref,assigned_adjuster_id").eq("id", claimId).maybeSingle();
  if (!claim) return failure(NOT_YOURS);
  if (isRepresentationKind(kindRaw) && session.role !== "owner" &&
      !(session.role === "adjuster" && claim.assigned_adjuster_id === session.userId)) {
    return failure("Representation documents can only be filed by the owner or the assigned adjuster.");
  }
  const metadata = parsePrivateUploadManifest(formData);
  if (!metadata) return failure("Choose valid files to upload.", { files: "Check the selected files and try again." });

  const prepared = await preparePrivateUploadSession(
    createAdminClient(), claimId, session.userId, metadata, kindRaw, visibilityRaw,
  );
  return prepared.status === "error" ? { ...prepared, values } : prepared;
}

/** Confirm one reserved upload. The caller and claim are checked again under RLS. */
export async function finalizeClaimDocumentUpload(formData: FormData): Promise<PrivateFinalizeState> {
  const user = await requireStaff("/admin");
  const capability = parsePrivateUploadCapability(formData);
  if (!capability) return { status: "error", message: privateUploadRetryMessage };
  const { id, token } = capability;
  const hash = privateUploadTokenHash(token);
  if (!(await checkPrivateUploadFinalizeLimit("staff", user.userId, hash))) {
    return { status: "error", message: RATE_LIMIT_ERROR };
  }
  const admin = createAdminClient();
  const reserved = await readPrivateUploadSession(admin, id, hash);
  if (!reserved || reserved.uploaded_by !== user.userId) return { status: "error", message: privateUploadRetryMessage };
  const supabase = await createClient();
  const { data: claim } = await supabase.from("claims")
    .select("id,claim_ref").eq("id", reserved.claim_id).maybeSingle();
  if (!claim) return { status: "error", message: NOT_YOURS };
  const result = await finalizePrivateUploadSession(admin, supabase, id, token, user.userId, claim.id);
  if (result.status === "success") {
    revalidatePath(`/admin/claims/${claim.id}`, "layout");
    return { ...result, message: "The documents were added to the claim." };
  }
  return result;
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

  if (error || !document || !isDocumentStoragePath(document.storage_path, document.claim_id)) {
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
  try {
    await writeAuditStrict(admin, {
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
  } catch (error) {
    console.error("[documents] signed URL audit failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }

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
