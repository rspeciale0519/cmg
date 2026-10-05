import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database-app";
import { isDocumentStoragePath } from "@/lib/validators/storage-path";
import type { StoredPrivateUploadFile } from "./session";
import { cancelPrivateUploadSession, privateUploadTokenHash, readPrivateUploadFiles, readPrivateUploadSession } from "./session";
import type { PrivateFinalizeState } from "./types";
import { verifyPrivateUploadFiles } from "./verified-files";

type Admin = SupabaseClient<Database>;
type Caller = SupabaseClient<Database>;
const RETRY = "We could not confirm this upload. Keep this page open and retry.";

const storedFilesSchema = z.array(z.object({
  index: z.number().int().nonnegative(),
  upload_path: z.string().min(1),
  storage_path: z.string().min(1),
  original_name: z.string().min(1),
  kind: z.string().min(1),
  visibility: z.string().min(1),
  mime: z.string().min(1),
  size_bytes: z.number().int().positive(),
  verification: z.unknown().nullable().optional(),
  copy_started_at: z.string().nullable().optional(),
}));

const documentSchema = z.object({
  id: z.string().uuid(),
  claim_id: z.string().uuid(),
  storage_path: z.string(),
  original_name: z.string(),
  kind: z.string(),
  mime: z.string(),
  size_bytes: z.number().int().positive(),
  uploaded_by: z.string().uuid().nullable(),
  visibility: z.string(),
});

const resultSchema = z.object({
  documents: z.array(z.object({ id: z.string().uuid(), storage_path: z.string() })),
});

function filesAreSafe(
  value: StoredPrivateUploadFile[],
  sessionId: string,
  claimId: string,
): boolean {
  const parsed = storedFilesSchema.safeParse(value);
  if (!parsed.success || parsed.data.length < 1 || parsed.data.length > 10) return false;
  const uploadPrefix = `private-upload/${sessionId}/`;
  return parsed.data.every((file, index) => file.index === index &&
    file.upload_path.startsWith(uploadPrefix) &&
    /^private-upload\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp|heic|heif|docx)$/.test(file.upload_path) &&
    isDocumentStoragePath(file.storage_path, claimId));
}

function docMatches(
  value: unknown,
  file: StoredPrivateUploadFile,
  claimId: string,
  userId: string,
): boolean {
  const document = documentSchema.safeParse(value);
  if (!document.success) return false;
  const row = document.data;
  return row.claim_id === claimId && row.storage_path === file.storage_path &&
    row.original_name === file.original_name && row.kind === file.kind && row.mime === file.mime &&
    row.size_bytes === file.size_bytes && row.uploaded_by === userId && row.visibility === file.visibility;
}

async function findDocuments(
  caller: Caller,
  claimId: string,
  userId: string,
  files: StoredPrivateUploadFile[],
) {
  const { data, error } = await caller.from("documents")
    .select("id,claim_id,storage_path,original_name,kind,mime,size_bytes,uploaded_by,visibility")
    .eq("claim_id", claimId).in("storage_path", files.map((file) => file.storage_path));
  if (error) return { state: "unavailable" as const };
  if (!data || data.length === 0) return { state: "none" as const };
  if (data.length !== files.length) return { state: "mismatch" as const };
  const rows = files.map((file) => data.find((row) => row.storage_path === file.storage_path));
  if (rows.some((row, index) => !row || !docMatches(row, files[index], claimId, userId))) {
    return { state: "mismatch" as const };
  }
  return { state: "complete" as const, rows: rows as NonNullable<(typeof rows)[number]>[] };
}

function completedState(value: unknown, files: StoredPrivateUploadFile[]): PrivateFinalizeState | null {
  const result = resultSchema.safeParse(value);
  if (!result.success || result.data.documents.length !== files.length ||
      new Set(result.data.documents.map((document) => document.storage_path)).size !== files.length) return null;
  const exact = files.every((file) => result.data.documents.some((document) =>
    document.storage_path === file.storage_path));
  if (!exact) return null;
  return {
    status: "success",
    message: files.length === 1 ? "Document added to the claim." : `${files.length} documents added to the claim.`,
  };
}

async function cancelForRestart(
  admin: Admin,
  id: string,
  hash: string,
  files: StoredPrivateUploadFile[],
): Promise<PrivateFinalizeState> {
  const cancelled = await cancelPrivateUploadSession(admin, id, hash);
  if (cancelled.error) return { status: "error", message: RETRY };
  const parsed = z.object({ status: z.literal("cancelled") }).safeParse(cancelled.data);
  if (parsed.success) return {
    status: "error",
    restartAllowed: true,
    message: "This upload session has ended. Check the details and submit again.",
  };
  const completed = completedState(cancelled.data, files);
  if (completed) return completed;
  return { status: "error", message: RETRY };
}

export async function finalizePrivateUploadSession(
  admin: Admin,
  caller: Caller,
  id: string,
  token: string,
  userId: string,
  claimId: string,
): Promise<PrivateFinalizeState> {
  const hash = privateUploadTokenHash(token);
  const session = await readPrivateUploadSession(admin, id, hash);
  if (!session || session.uploaded_by !== userId || session.claim_id !== claimId) {
    return { status: "error", message: RETRY };
  }
  const files = await readPrivateUploadFiles(admin, id);
  if (!filesAreSafe(files, id, claimId)) return { status: "error", message: RETRY };

  if (session.status === "completed") {
    return completedState(session.result, files) ?? { status: "error", message: RETRY };
  }
  if (session.status === "cancelled") return cancelForRestart(admin, id, hash, files);

  const existing = await findDocuments(caller, claimId, userId, files);
  if (existing.state === "unavailable" || existing.state === "mismatch") {
    return { status: "error", message: RETRY };
  }
  const expired = Date.now() >= Date.parse(session.expires_at);
  // Expired sessions can settle an uncertain insert, but cannot add new rows.
  if (expired && existing.state !== "complete") return cancelForRestart(admin, id, hash, files);
  if (expired && existing.state === "complete") {
    const settled = await finalizeRows(admin, id, hash, existing.rows.map((row) => row.id), files);
    return settled ?? { status: "error", message: RETRY };
  }

  const verification = await verifyPrivateUploadFiles(admin, id, token, files);
  if (!verification.ok) {
    if (verification.restart) return cancelForRestart(admin, id, hash, files);
    if (verification.invalid) return cancelForRestart(admin, id, hash, files);
    return { status: "error", message: RETRY };
  }
  if (verification.pending > 0) return { status: "idle", pendingFiles: verification.pending };

  let rows = existing.state === "complete" ? existing.rows : null;
  if (!rows) {
    const inserts = files.map((file) => ({
      claim_id: claimId,
      storage_path: file.storage_path,
      original_name: file.original_name,
      kind: file.kind,
      mime: file.mime,
      size_bytes: file.size_bytes,
      uploaded_by: userId,
      visibility: file.visibility,
    }));
    const inserted = await caller.from("documents").insert(inserts).select(
      "id,claim_id,storage_path,original_name,kind,mime,size_bytes,uploaded_by,visibility",
    );
    if (!inserted.error && inserted.data?.length === files.length &&
        inserted.data.every((row, index) => docMatches(row, files[index], claimId, userId))) {
      rows = inserted.data;
    } else {
      // A response may be lost after Postgres committed the batch. Read only
      // these reserved paths through the same RLS-scoped caller client.
      const reconciled = await findDocuments(caller, claimId, userId, files);
      if (reconciled.state === "complete") rows = reconciled.rows;
      else return { status: "error", message: RETRY };
    }
  }

  const settled = await finalizeRows(admin, id, hash, rows.map((row) => row.id), files);
  if (settled) return settled;
  const reconciled = await readPrivateUploadSession(admin, id, hash);
  return reconciled?.status === "completed"
    ? completedState(reconciled.result, files) ?? { status: "error", message: RETRY }
    : { status: "error", message: RETRY };
}

async function finalizeRows(
  admin: Admin,
  id: string,
  hash: string,
  documentIds: string[],
  files: StoredPrivateUploadFile[],
): Promise<PrivateFinalizeState | null> {
  const finalized = await admin.rpc("finalize_private_upload_session", {
    p_id: id,
    p_token_hash: hash,
    p_document_ids: documentIds,
  });
  if (!finalized.error) {
    const success = completedState(finalized.data, files);
    if (success) return success;
  }
  return null;
}

export const privateUploadRetryMessage = RETRY;
