import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";
import { CLAIM_DOCS_BUCKET } from "@/lib/actions/intake-storage";
import { dispatchOutbox } from "@/lib/email/outbox";
import { GENERIC_ERROR } from "@/lib/actions/types";
import type { IntakeInput } from "@/lib/validators/intake";
import { allocateIntakeManifest, type IntakeManifestFile, parseIntakeManifest } from "./manifest";
import { buildIntakeSubmission } from "./submission";
import type { IntakeReferral } from "./referral";
import type { IntakeFinalizeState, IntakeStartState } from "./upload-types";
import { verifyIntakeFiles } from "./verified-files";

type Admin = SupabaseClient<Database>;
const retryMessage = "We could not confirm this intake. Keep this tab open and use the retry button. Your existing submission will be checked again.";
const retryState: IntakeFinalizeState = { status: "error", message: retryMessage };
const resultSchema = z.object({
  id: z.string().uuid(),
  claim_ref: z.string().min(1),
  outbox_ids: z.array(z.string().uuid()),
});
const dateString = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const reservationSchema = z.object({
  expires_at: dateString,
  sign_until: dateString,
  cleanup_after: dateString,
});

export function uploadTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validUploadCapability(id: unknown, token: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) &&
    typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

// This inspects lifetime metadata from the trusted Storage response. It does
// not authenticate client tokens or replace Storage's signature validation.
function capabilityFitsEmbargo(token: string, cleanupAfter: string): boolean {
  try {
    const payload: unknown = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    const parsed = z.object({ exp: z.number().int().positive() }).safeParse(payload);
    return parsed.success && parsed.data.exp * 1000 <= Date.parse(cleanupAfter);
  } catch {
    return false;
  }
}

export async function prepareIntakeSession(
  admin: Admin,
  input: IntakeInput,
  metadata: NonNullable<ReturnType<typeof parseIntakeManifest>>,
  ip: string | null,
  referral: IntakeReferral | null = null,
): Promise<IntakeStartState> {
  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const files = allocateIntakeManifest(id, metadata);
  const submission = buildIntakeSubmission(input, files.map((file) => ({
    path: file.storage_path, originalName: file.original_name, mime: file.mime, size: file.size_bytes,
  })), ip, referral);
  const { data, error } = await admin.rpc("begin_intake_upload_session", {
    p_id: id, p_token_hash: uploadTokenHash(token), p_submission: submission, p_files: files,
  });
  const reservation = reservationSchema.safeParse(data);
  if (error || !reservation.success) {
    console.error("[intake] upload reservation failed");
    return { status: "error", message: GENERIC_ERROR };
  }

  const uploads = [];
  for (const file of files) {
    if (Date.now() >= Date.parse(reservation.data.sign_until)) {
      console.error("[intake] upload signing window expired");
      return { status: "error", message: GENERIC_ERROR };
    }
    const signed = await admin.storage.from(CLAIM_DOCS_BUCKET)
      .createSignedUploadUrl(file.upload_path, { upsert: false });
    if (!signed.data || signed.error ||
        !capabilityFitsEmbargo(signed.data.token, reservation.data.cleanup_after)) {
      console.error("[intake] upload authority unavailable");
      return { status: "error", message: GENERIC_ERROR };
    }
    uploads.push({ index: file.index, path: file.upload_path, token: signed.data.token, mime: file.mime });
  }
  return { status: "idle", uploadSession: {
    id, token, expiresAt: reservation.data.expires_at, uploads,
  } };
}

async function committedState(admin: Admin, value: unknown): Promise<IntakeFinalizeState | null> {
  const result = resultSchema.safeParse(value);
  if (!result.success) return null;
  try {
    await dispatchOutbox(admin, result.data.outbox_ids);
  } catch {
    // The durable outbox owns delivery retries. An email fault cannot undo or
    // misreport the confirmed claim transaction.
    console.error("[intake] outbox dispatch deferred");
  }
  return { status: "success", message: "Intake received.", reference: result.data.claim_ref };
}

async function cancelForRestart(admin: Admin, id: string, hash: string): Promise<IntakeFinalizeState> {
  const { data, error } = await admin.rpc("cancel_intake_upload_session", {
    p_id: id, p_token_hash: hash,
  });
  if (error) return retryState;
  const cancelled = z.object({ status: z.literal("cancelled") }).safeParse(data);
  if (cancelled.success) {
    return {
      status: "error", restartAllowed: true,
      message: "The upload session closed. Check your files and submit again. No intake was recorded for this session.",
    };
  }
  const completed = z.object({ status: z.literal("completed"), result: z.unknown() }).safeParse(data);
  return completed.success ? (await committedState(admin, completed.data.result) ?? retryState) : retryState;
}

async function readSession(admin: Admin, id: string, hash: string) {
  const { data, error } = await admin.from("intake_upload_sessions")
    .select("id,status,result,expires_at").eq("id", id).eq("token_hash", hash).maybeSingle();
  if (error) throw new Error("Intake session lookup failed.");
  return data;
}

export async function finalizeIntakeSession(admin: Admin, id: string, token: string): Promise<IntakeFinalizeState> {
  const hash = uploadTokenHash(token);
  const session = await readSession(admin, id, hash);
  if (!session) return retryState;
  // A committed result remains recoverable even after the upload link expires.
  if (session.status === "completed") return await committedState(admin, session.result) ?? retryState;
  if (session.status === "cancelled" || Date.now() >= Date.parse(session.expires_at)) {
    return cancelForRestart(admin, id, hash);
  }

  const { data: files, error } = await admin.from("intake_upload_files")
    .select("index,upload_path,storage_path,original_name,mime,size_bytes,verification")
    .eq("session_id", id).order("index");
  if (error || !files) return retryState;
  const verified = await verifyIntakeFiles(
    admin,
    files as Array<IntakeManifestFile & { verification?: unknown }>,
    id,
    hash,
  );
  if (!verified.ok) {
    if (verified.invalid || verified.abandoned) return cancelForRestart(admin, id, hash);
    const concurrent = await readSession(admin, id, hash);
    if (concurrent?.status === "completed") return await committedState(admin, concurrent.result) ?? retryState;
    return retryState;
  }
  if (verified.pending > 0) return { status: "idle", pendingFiles: verified.pending };
  const finalized = await admin.rpc("finalize_intake_upload_session", {
    p_id: id, p_token_hash: hash, p_verified: verified.files,
  });
  if (!finalized.error) {
    const success = await committedState(admin, finalized.data);
    if (success) return success;
  }
  // A failed or malformed response does not prove rollback. Reconcile the same
  // session, and keep its capabilities on the client if the result is unknown.
  const reconciled = await readSession(admin, id, hash);
  if (reconciled?.status === "completed") return await committedState(admin, reconciled.result) ?? retryState;
  if (reconciled?.status === "cancelled" ||
      (reconciled && Date.now() >= Date.parse(reconciled.expires_at))) {
    return cancelForRestart(admin, id, hash);
  }
  return retryState;
}
