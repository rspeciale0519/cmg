import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database-app";
import { CLAIM_DOCS_BUCKET } from "@/lib/actions/intake-storage";
import type { IntakeManifestFile } from "./manifest";
import { verifyFileSignature } from "./file-signatures";
import { storageRangeReader } from "./storage-reader";

type Admin = SupabaseClient<Database>;
export type VerifiedIntakeFile = {
  index: number;
  object_id: string;
  version: string;
  mime: string;
  size_bytes: number;
};
const verificationSchema = z.object({
  index: z.number().int(), object_id: z.string().uuid(), version: z.string().min(1),
  mime: z.string(), size_bytes: z.number().int().positive(),
});
type StoredManifestFile = IntakeManifestFile & { verification?: unknown };

type StoredInfo = {
  id: string;
  version: string;
  size?: number;
  contentType?: string;
};

function matches(info: StoredInfo, file: IntakeManifestFile): boolean {
  return info.size === file.size_bytes && info.contentType === file.mime;
}

function isMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  return value.status === 404 || value.statusCode === "404" ||
    value.code === "NoSuchKey" || value.code === "NotFound";
}

export async function verifyIntakeFiles(
  admin: Admin,
  files: StoredManifestFile[],
  sessionId = "",
  tokenHash = "",
): Promise<
  { ok: true; files: VerifiedIntakeFile[]; pending: number } | { ok: false; invalid: boolean; abandoned?: boolean }
> {
  const storage = admin.storage.from(CLAIM_DOCS_BUCKET);
  const verified: VerifiedIntakeFile[] = [];
  let checkedNewFile = false;

  for (const file of files) {
    if (file.verification != null) {
      const cached = verificationSchema.safeParse(file.verification);
      if (!cached.success || cached.data.index !== file.index || cached.data.mime !== file.mime ||
          cached.data.size_bytes !== file.size_bytes) throw new Error("Stored file verification unavailable.");
      verified.push(cached.data);
      continue;
    }
    // One uncached file per action keeps progress across function timeouts.
    // The next request reads these immutable proofs and skips completed files.
    if (checkedNewFile) continue;
    checkedNewFile = true;
    let destination = await storage.info(file.storage_path);
    if (destination.error && !isMissing(destination.error)) return { ok: false, invalid: false };
    if (!destination.data) {
      // Copies isolate documents from outstanding upload capabilities. The
      // existing immutable destination is reused after an uncertain response.
      const source = await storage.info(file.upload_path);
      if (source.error && !isMissing(source.error)) return { ok: false, invalid: false };
      if (!source.data) return { ok: false, invalid: false };
      if (!matches(source.data, file)) return { ok: false, invalid: true };
      const permission = await admin.rpc("claim_intake_upload_copy", {
        p_id: sessionId, p_token_hash: tokenHash, p_index: file.index,
      });
      if (permission.error || !permission.data || typeof permission.data !== "object" || Array.isArray(permission.data)) {
        return { ok: false, invalid: false };
      }
      const copy = permission.data;
      // Storage checks copy permissions before transferring bytes. Two copy
      // requests can otherwise race to replace the destination. Never dispatch
      // twice to one path, including after a timeout or a stale worker.
      if (copy.allowed === true) await storage.copy(file.upload_path, file.storage_path);
      destination = await storage.info(file.storage_path);
      if (destination.error && !isMissing(destination.error)) return { ok: false, invalid: false };
      if (!destination.data && typeof copy.copy_started_at === "string" &&
          Date.now() - Date.parse(copy.copy_started_at) >= 60_000) {
        return { ok: false, invalid: false, abandoned: true };
      }
    }
    if (!destination.data) return { ok: false, invalid: false };
    const info = destination.data;
    if (!matches(info, file)) return { ok: false, invalid: true };
    if (!info.id || !info.version) return { ok: false, invalid: false };

    const signed = await storage.createSignedUrl(file.storage_path, 300);
    if (!signed.data?.signedUrl) return { ok: false, invalid: false };
    const url = new URL(signed.data.signedUrl);
    const expectedOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
    if (url.origin !== expectedOrigin || url.username || url.password ||
        url.pathname !== `/storage/v1/object/sign/${CLAIM_DOCS_BUCKET}/${file.storage_path}`) {
      throw new Error("File verification URL unavailable.");
    }
    const valid = await verifyFileSignature(
      file.mime, file.size_bytes, storageRangeReader(url.href, file.size_bytes),
    );
    if (!valid) return { ok: false, invalid: true };
    const proof: VerifiedIntakeFile = {
      index: file.index,
      object_id: info.id,
      version: info.version,
      mime: file.mime,
      size_bytes: file.size_bytes,
    };
    const saved = await admin.from("intake_upload_files").update({ verification: proof })
      .eq("session_id", sessionId).eq("index", file.index).is("verification", null);
    if (saved.error) throw new Error("File verification record unavailable.");
    const stored = await admin.from("intake_upload_files").select("verification")
      .eq("session_id", sessionId).eq("index", file.index).maybeSingle();
    if (stored.error) throw new Error("File verification record unavailable.");
    const savedProof = verificationSchema.safeParse(stored.data?.verification);
    if (!savedProof.success) throw new Error("File verification record unavailable.");
    verified.push(savedProof.data);
  }
  return { ok: true, files: verified, pending: files.length - verified.length };
}
