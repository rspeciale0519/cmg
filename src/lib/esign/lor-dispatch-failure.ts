import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import type { Database } from "@/types/database-app";
import { settleDispatch } from "./dispatch-ledger";
import { ESignError, type ESignErrorCode, type ESignMode } from "./types";

type Admin = SupabaseClient<Database>;
type FailureCode = "not_configured" | "provider_error" | "request_in_progress";
type Failure = { ok: false; code: FailureCode; message: string };

export const PROVIDER_FAILURE_MESSAGE =
  "The signing request could not be completed. Check the request status before you try again.";
export const SIGNING_NOT_CONFIGURED_MESSAGE =
  "Electronic signing is not configured. Contact the site administrator before you try again.";

const SAFE_PROVIDER_CODES = new Set<ESignErrorCode>([
  "not_configured",
  "unsupported",
  "creation_failed",
  "draft_timeout",
  "send_failed",
  "download_failed",
  "rate_limited",
]);

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
  const providerError = input.error instanceof ESignError ? input.error : null;
  const code: FailureCode =
    providerError?.code === "not_configured"
      ? "not_configured"
      : "provider_error";
  const message =
    code === "not_configured"
      ? SIGNING_NOT_CONFIGURED_MESSAGE
      : PROVIDER_FAILURE_MESSAGE;
  const uncertain = providerError?.deliveryUncertain === true;
  const httpStatus = providerError?.httpStatus;
  // Provider text can contain recipient data or credentials. Keep only known codes.
  const diagnostics = {
    mode: input.mode,
    code,
    provider_code:
      providerError && SAFE_PROVIDER_CODES.has(providerError.code)
        ? providerError.code
        : "unexpected_error",
    http_status:
      typeof httpStatus === "number" && Number.isInteger(httpStatus) &&
      httpStatus >= 100 && httpStatus <= 599
        ? httpStatus
        : null,
    delivery_uncertain: uncertain,
  };

  console.error("[esign] sendLor dispatch failed", {
    claimId: input.claimId,
    ...diagnostics,
  });
  if (uncertain) {
    await admin.from("claims").update({ esign_status: "document.send_uncertain" })
      .eq("id", input.claimId).eq("esign_dispatch_token", input.claimToken);
    await writeAudit(admin, {
      actorId: input.actorId,
      action: "esign.lor_send_uncertain",
      entity: "claims",
      entityId: input.claimId,
      meta: { ...diagnostics, request_id: input.requestId },
    });
    return {
      ok: false,
      code: "request_in_progress",
      message:
        "PandaDoc may have accepted this letter. Automatic retry is locked to prevent a duplicate. Check the request in PandaDoc before manual recovery.",
    };
  }

  const { error: persistError } = await admin.from("claims")
    .update({ esign_status: "document.creation_failed" })
    .eq("id", input.claimId).eq("esign_dispatch_token", input.claimToken);
  if (persistError) {
    console.error("[esign] sendLor failure state persist failed", {
      claimId: input.claimId,
      code: "failure_state_persist_failed",
    });
  }
  await writeAudit(admin, {
    actorId: input.actorId,
    action: "esign.lor_send_failed",
    entity: "claims",
    entityId: input.claimId,
    meta: diagnostics,
  });
  await settleDispatch(admin, input.requestId, input.claimToken, "failed", {
    ok: false,
    code,
    message,
  });
  return { ok: false, code, message };
}
