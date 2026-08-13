import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import type { Database } from "@/types/database";
import { settleDispatch } from "./dispatch-ledger";
import { ESignError, type ESignMode } from "./types";

type Admin = SupabaseClient<Database>;
type FailureCode = "not_configured" | "provider_error" | "request_in_progress";
type Failure = { ok: false; code: FailureCode; message: string };

export async function handleDispatchFailure(
  admin: Admin,
  input: {
    claimId: string;
    actorId: string | null;
    mode: ESignMode;
    requestId: string;
    claimToken: string;
    error: unknown;
  },
): Promise<Failure> {
  const code: FailureCode =
    input.error instanceof ESignError && input.error.code === "not_configured"
      ? "not_configured"
      : "provider_error";
  const message =
    input.error instanceof Error
      ? input.error.message
      : "The e-signature provider failed.";
  const uncertain = input.error instanceof ESignError && input.error.deliveryUncertain;

  console.error("[esign] sendLor dispatch failed", {
    claimId: input.claimId,
    mode: input.mode,
    message,
    deliveryUncertain: uncertain,
  });
  if (uncertain) {
    await admin.from("claims").update({ esign_status: "document.send_uncertain" })
      .eq("id", input.claimId).eq("esign_dispatch_token", input.claimToken);
    await writeAudit(admin, {
      actorId: input.actorId,
      action: "esign.lor_send_uncertain",
      entity: "claims",
      entityId: input.claimId,
      meta: { mode: input.mode, code, message, request_id: input.requestId },
    });
    return {
      ok: false,
      code: "request_in_progress",
      message:
        "PandaDoc may have accepted this letter. Automatic retry is locked to prevent a duplicate; reconcile this request in PandaDoc before choosing manual recovery.",
    };
  }

  const { error: persistError } = await admin.from("claims")
    .update({ esign_status: "document.creation_failed" })
    .eq("id", input.claimId).eq("esign_dispatch_token", input.claimToken);
  if (persistError) {
    console.error("[esign] sendLor failure state persist failed", {
      claimId: input.claimId,
      message: persistError.message,
    });
  }
  await writeAudit(admin, {
    actorId: input.actorId,
    action: "esign.lor_send_failed",
    entity: "claims",
    entityId: input.claimId,
    meta: { mode: input.mode, code, message },
  });
  await settleDispatch(admin, input.requestId, input.claimToken, "failed", {
    ok: false,
    code,
    message,
  });
  return { ok: false, code, message };
}
