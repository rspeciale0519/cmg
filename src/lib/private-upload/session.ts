import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database-app";
import { GENERIC_ERROR } from "@/lib/actions/types";
import {
  allocatePrivateUploadManifest,
  PRIVATE_UPLOAD_BUCKET,
  type PrivateUploadFile,
  type PrivateUploadMetadata,
} from "./manifest";
import type { PrivatePrepareState, PrivateUploadSession } from "./types";

type Admin = SupabaseClient<Database>;
const uuid = z.string().uuid();
const dateString = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const reservationSchema = z.object({
  expires_at: dateString,
  sign_until: dateString,
  cleanup_after: dateString,
  files: z.array(z.object({
    index: z.number().int().nonnegative(),
    upload_path: z.string().min(1),
    storage_path: z.string().min(1),
    original_name: z.string().min(1),
    kind: z.string().min(1),
    visibility: z.string().min(1),
    mime: z.string().min(1),
    size_bytes: z.number().int().positive(),
  })),
});

export function privateUploadTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validPrivateUploadCapability(id: unknown, token: unknown): id is string {
  return typeof id === "string" && uuid.safeParse(id).success &&
    typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function parsePrivateUploadCapability(formData: FormData): { id: string; token: string } | null {
  if ([...formData.values()].some((value) => typeof value !== "string")) return null;
  const id = formData.get("id");
  const token = formData.get("token");
  return typeof id === "string" && typeof token === "string" &&
    validPrivateUploadCapability(id, token) ? { id, token } : null;
}

function capabilityFitsEmbargo(token: string, cleanupAfter: string): boolean {
  try {
    const payload: unknown = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    const parsed = z.object({ exp: z.number().int().positive() }).safeParse(payload);
    return parsed.success && parsed.data.exp * 1000 <= Date.parse(cleanupAfter);
  } catch {
    return false;
  }
}

export async function preparePrivateUploadSession(
  admin: Admin,
  claimId: string,
  uploadedBy: string,
  metadata: PrivateUploadMetadata,
  kind: PrivateUploadFile["kind"],
  visibility: PrivateUploadFile["visibility"],
): Promise<PrivatePrepareState> {
  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const files = allocatePrivateUploadManifest(id, claimId, metadata, kind, visibility);
  const { data, error } = await admin.rpc("begin_private_upload_session", {
    p_id: id,
    p_token_hash: privateUploadTokenHash(token),
    p_claim_id: claimId,
    p_uploaded_by: uploadedBy,
    p_files: files,
  });
  const reservation = reservationSchema.safeParse(data);
  if (error || !reservation.success || reservation.data.files.length !== files.length ||
      reservation.data.files.some((file, index) => {
        const expected = files[index];
        return file.index !== expected.index || file.upload_path !== expected.upload_path ||
          file.storage_path !== expected.storage_path || file.original_name !== expected.original_name ||
          file.kind !== expected.kind || file.visibility !== expected.visibility || file.mime !== expected.mime ||
          file.size_bytes !== expected.size_bytes;
      })) {
    console.error("[private-upload] reservation unavailable");
    return { status: "error", message: GENERIC_ERROR };
  }

  const uploads: PrivateUploadSession["uploads"] = [];
  for (const file of files) {
    if (Date.now() >= Date.parse(reservation.data.sign_until)) {
      await cancelPrivateUploadSession(admin, id, privateUploadTokenHash(token));
      return { status: "error", message: GENERIC_ERROR };
    }
    const signed = await admin.storage.from(PRIVATE_UPLOAD_BUCKET)
      .createSignedUploadUrl(file.upload_path, { upsert: false });
    if (!signed.data || signed.error ||
        !capabilityFitsEmbargo(signed.data.token, reservation.data.cleanup_after)) {
      await cancelPrivateUploadSession(admin, id, privateUploadTokenHash(token));
      console.error("[private-upload] upload authority unavailable");
      return { status: "error", message: GENERIC_ERROR };
    }
    uploads.push({ index: file.index, path: file.upload_path, token: signed.data.token, mime: file.mime });
  }

  return { status: "idle", uploadSession: {
    id, token, expiresAt: reservation.data.expires_at, uploads,
  } };
}

export async function cancelPrivateUploadSession(admin: Admin, id: string, tokenHash: string) {
  return admin.rpc("cancel_private_upload_session", { p_id: id, p_token_hash: tokenHash });
}

export type StoredPrivateUploadFile = Pick<
  Database["public"]["Tables"]["private_upload_files"]["Row"],
  "index" | "upload_path" | "storage_path" | "original_name" | "kind" | "visibility" |
  "mime" | "size_bytes" | "verification" | "copy_started_at"
>;

export async function readPrivateUploadSession(admin: Admin, id: string, tokenHash: string) {
  const { data, error } = await admin.from("private_upload_sessions")
    .select("id,claim_id,uploaded_by,status,result,expires_at")
    .eq("id", id).eq("token_hash", tokenHash).maybeSingle();
  if (error) throw new Error("Private upload session lookup failed.");
  if (!data) return null;
  const parsed = z.object({
    id: z.string().uuid(), claim_id: z.string().uuid(), uploaded_by: z.string().uuid(),
    status: z.enum(["pending", "completed", "cancelled"]), result: z.unknown().nullable(),
    expires_at: dateString,
  }).safeParse(data);
  if (!parsed.success) throw new Error("Private upload session data is malformed.");
  return parsed.data;
}

export async function readPrivateUploadFiles(admin: Admin, id: string): Promise<StoredPrivateUploadFile[]> {
  const { data, error } = await admin.from("private_upload_files")
    .select("index,upload_path,storage_path,original_name,kind,visibility,mime,size_bytes,verification,copy_started_at")
    .eq("session_id", id).order("index");
  if (error || !data) throw new Error("Private upload file lookup failed.");
  const parsed = z.array(z.object({
    index: z.number().int().nonnegative(), upload_path: z.string(), storage_path: z.string(),
    original_name: z.string(), kind: z.string(), visibility: z.string(), mime: z.string(),
    size_bytes: z.number().int().positive(), verification: z.unknown().nullable(),
    copy_started_at: z.string().nullable(),
  })).safeParse(data);
  if (!parsed.success) throw new Error("Private upload file data is malformed.");
  return data;
}
