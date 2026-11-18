"use server";

import { requireStaff } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { issueDocumentDownload } from "./documents";
import { idleDownloadState, type DownloadState } from "./types";

export type LegalPackageDownloadState = DownloadState & { sizeBytes?: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFUSED = "That package document is not available. Review the package again.";

export async function issueLegalPackageDownload(
  _previous: LegalPackageDownloadState,
  formData: FormData,
): Promise<LegalPackageDownloadState> {
  await requireStaff("/admin");
  const packageId = String(formData.get("packageId") ?? "");
  const documentId = String(formData.get("documentId") ?? "");
  if (!UUID.test(packageId) || !UUID.test(documentId)) return { status: "error", message: REFUSED };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("legal_package_document", {
    p_package_id: packageId, p_document_id: documentId,
  });
  const document = data?.[0];
  if (error || !document || document.id !== documentId || document.size_bytes < 1) {
    return { status: "error", message: REFUSED };
  }
  // The RPC proves package membership, current authority, and manifest equality.
  // Reuse the existing download action for storage-path checks and strict audit.
  const request = new FormData(); request.set("documentId", documentId);
  const download = await issueDocumentDownload(idleDownloadState, request);
  if (download.status !== "success") return download;
  // Link issuance includes asynchronous storage and audit work. Recheck the
  // reviewed manifest and manager authority before disclosing that link.
  const latest = await supabase.rpc("legal_package_document", {
    p_package_id: packageId, p_document_id: documentId,
  });
  const current = latest.data?.[0];
  if (latest.error || !current || current.id !== document.id || current.claim_id !== document.claim_id
      || current.size_bytes !== document.size_bytes || current.updated_at !== document.updated_at
      || current.original_name !== document.original_name || current.mime !== document.mime) {
    return { status: "error", message: REFUSED };
  }
  return { ...download, sizeBytes: current.size_bytes };
}
