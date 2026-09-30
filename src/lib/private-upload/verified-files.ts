import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database-app";
import { CLAIM_DOCS_BUCKET } from "@/lib/actions/intake-storage";
import { verifyFileSignature } from "@/lib/intake/file-signatures";
import { storageRangeReader } from "@/lib/intake/storage-reader";
import type { StoredPrivateUploadFile } from "./session";
import { privateUploadTokenHash } from "./session";

type Admin = SupabaseClient<Database>;
type Verification = { index: number; object_id: string; version: string; mime: string; size_bytes: number };
type VerificationResult = { ok: true; pending: number } | { ok: false; invalid: boolean; restart?: boolean };

const proofSchema = z.object({
  index: z.number().int().nonnegative(),
  object_id: z.string().uuid(),
  version: z.string().min(1),
  mime: z.string().min(1),
  size_bytes: z.number().int().positive(),
});

type StorageInfo = { id: string; version: string; size?: number; contentType?: string };

function metadataMatches(info: StorageInfo, file: StoredPrivateUploadFile): boolean {
  return info.size === file.size_bytes && info.contentType === file.mime;
}

function isMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  return value.status === 404 || value.statusCode === "404" || value.code === "NoSuchKey" || value.code === "NotFound";
}

function validStoredProof(value: unknown, file: StoredPrivateUploadFile): Verification | null {
  const parsed = proofSchema.safeParse(value);
  if (!parsed.success || parsed.data.index !== file.index || parsed.data.mime !== file.mime ||
      parsed.data.size_bytes !== file.size_bytes) return null;
  return parsed.data;
}

export async function verifyPrivateUploadFiles(
  admin: Admin,
  sessionId: string,
  token: string,
  files: StoredPrivateUploadFile[],
): Promise<VerificationResult> {
  const storage = admin.storage.from(CLAIM_DOCS_BUCKET);
  const storedProofs: Verification[] = [];
  let checkedNewFile = false;

  for (const file of files) {
    if (file.verification != null) {
      const proof = validStoredProof(file.verification, file);
      if (!proof) throw new Error("Stored private upload verification is malformed.");
      storedProofs.push(proof);
      continue;
    }
    // Persist and confirm one proof per request so a timeout cannot lose progress.
    if (checkedNewFile) continue;
    checkedNewFile = true;

    let destination = await storage.info(file.storage_path);
    if (destination.error && !isMissing(destination.error)) return { ok: false, invalid: false };
    if (!destination.data) {
      const source = await storage.info(file.upload_path);
      if (source.error && !isMissing(source.error)) return { ok: false, invalid: false };
      if (!source.data) return { ok: true, pending: files.length - storedProofs.length };
      if (!metadataMatches(source.data, file)) return { ok: false, invalid: true };

      const permission = await admin.rpc("claim_private_upload_copy", {
        p_id: sessionId,
        p_token_hash: privateUploadTokenHash(token),
        p_index: file.index,
      });
      const copyGate = z.object({
        allowed: z.boolean(),
        copy_started_at: z.string().datetime({ offset: true }).nullable().optional(),
      }).safeParse(permission.data);
      if (permission.error || !copyGate.success) return { ok: false, invalid: false };
      if (copyGate.data.allowed) await storage.copy(file.upload_path, file.storage_path);
      destination = await storage.info(file.storage_path);
      if (destination.error && !isMissing(destination.error)) return { ok: false, invalid: false };
      if (!destination.data && copyGate.data.copy_started_at &&
          Date.now() - Date.parse(copyGate.data.copy_started_at) >= 60_000) {
        return { ok: false, invalid: false, restart: true };
      }
    }
    if (!destination.data) return { ok: true, pending: files.length - storedProofs.length };
    const info = destination.data as StorageInfo;
    if (!metadataMatches(info, file)) return { ok: false, invalid: true };
    if (!info.id || !info.version) return { ok: false, invalid: false };

    const signed = await storage.createSignedUrl(file.storage_path, 300);
    if (signed.error || !signed.data?.signedUrl) return { ok: false, invalid: false };
    const url = new URL(signed.data.signedUrl);
    const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!configured) throw new Error("Supabase URL is unavailable for private upload verification.");
    const expectedOrigin = new URL(configured).origin;
    if (url.origin !== expectedOrigin || url.username || url.password ||
        url.pathname !== `/storage/v1/object/sign/${CLAIM_DOCS_BUCKET}/${file.storage_path}`) {
      throw new Error("Private upload verification URL is invalid.");
    }
    const valid = await verifyFileSignature(file.mime, file.size_bytes,
      storageRangeReader(url.href, file.size_bytes));
    if (!valid) return { ok: false, invalid: true };

    const proof: Verification = {
      index: file.index,
      object_id: info.id,
      version: info.version,
      mime: file.mime,
      size_bytes: file.size_bytes,
    };
    const saved = await admin.from("private_upload_files").update({ verification: proof })
      .eq("session_id", sessionId).eq("index", file.index).is("verification", null);
    if (saved.error) throw new Error("Private upload verification could not be saved.");
    const reread = await admin.from("private_upload_files").select("verification")
      .eq("session_id", sessionId).eq("index", file.index).maybeSingle();
    if (reread.error) throw new Error("Private upload verification could not be read.");
    const stored = z.object({ verification: z.unknown().nullable() }).safeParse(reread.data);
    if (!stored.success) throw new Error("Private upload verification data is malformed.");
    const confirmed = validStoredProof(stored.data.verification, file);
    if (!confirmed) throw new Error("Private upload verification was not confirmed.");
    storedProofs.push(confirmed);
  }

  return { ok: true, pending: files.length - storedProofs.length };
}
