import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database-app";
import { claimDispatch, markDispatchSending, settleDispatch } from "./dispatch-ledger";
import { handleDispatchFailure } from "./lor-dispatch-failure";
import { collectLorLetter, loadLorClaim, type LorLetterFailureCode } from "./lor-letter";
import { createESignProvider } from "./provider";
import {
  ESignError,
  PANDADOC_TERMINAL_FAILURE_STATUSES,
  type ESignMode,
  type ESignProvider,
} from "./types";

type Admin = SupabaseClient<Database>;

export type SendLorInput = {
  claimId: string;
  /** Stable per form render, so retries of one POST cannot dispatch twice. */
  requestId?: string;
  /** Staff profile id — feed author and audit actor. */
  actorId?: string | null;
  /** Contingency fee stamped into the letter; falls back to claim_financials. */
  feePercent?: number | null;
  /** Overrides the covering message in the provider's notification email. */
  message?: string | null;
};

export type SendLorSuccess = {
  ok: true;
  mode: ESignMode;
  claimId: string;
  claimRef: string;
  providerDocumentId: string | null;
  esignStatus: string;
  /** False when the claim was already at `lor_sent` and this was a re-send. */
  transitioned: boolean;
  /** False in manual mode: staff still have to deliver the letter. */
  deliveredByProvider: boolean;
  recipients: string[];
};

export type SendLorFailureCode =
  /* The content gates live in `./lor-letter`, so the manual prefilled-PDF path
     is refused by the same five codes this one is. */
  | LorLetterFailureCode
  | "invalid_status"
  | "not_configured"
  | "provider_error"
  | "persist_failed"
  | "request_in_progress"
  | "request_already_processed"
  /** Raised by the authorized entry point in `./send-lor`, never in here. */
  | "not_authorized";

export type SendLorFailure = { ok: false; code: SendLorFailureCode; message: string };

export type SendLorResult = SendLorSuccess | SendLorFailure;

export type SendLorDeps = {
  admin?: Admin;
  provider?: ESignProvider;
  /** Fault-injection seam for proving post-send persistence failures stay locked. */
  beforePersist?: () => Promise<void>;
};

/**
 * Service-role mechanism, not an authorization entry point. Only the
 * authorized `sendLor()` wrapper may call it.
 *
 * Puts the Letter of Representation in front of the claimants and records that
 * it happened (blueprint §"sendLor implementation steps", spec §6 "LOR").
 *
 * Provider-agnostic on purpose: the transport differs between PandaDoc and
 * manual sending, but the claim record does not. Both paths persist
 * `esign_status`, advance `under_review → lor_sent`, write a history row, post
 * a shared feed entry and leave an audit trail.
 *
 * Never throws for an expected condition — the admin UI gets a discriminated
 * result it can render. Re-sending from `lor_sent` is allowed and does not
 * re-transition.
 */
export async function dispatchLorForClaim(
  input: SendLorInput,
  deps: SendLorDeps = {},
): Promise<SendLorResult> {
  const admin = deps.admin ?? createAdminClient();
  const provider = deps.provider ?? createESignProvider();

  const claim = await loadLorClaim(admin, input.claimId);

  if (!claim) {
    return {
      ok: false,
      code: "claim_not_found",
      message: `No claim ${input.claimId}`,
    };
  }

  if (claim.status !== "under_review" && claim.status !== "lor_sent") {
    return {
      ok: false,
      code: "invalid_status",
      message: `A Letter of Representation is sent from under_review; this claim is ${claim.status}.`,
    };
  }

  const retryable =
    claim.esign_status === "document.creation_failed" ||
    (claim.esign_status !== null &&
      (PANDADOC_TERMINAL_FAILURE_STATUSES as readonly string[]).includes(
        claim.esign_status,
      ));
  if (claim.status === "lor_sent" && !retryable) {
    return {
      ok: false,
      code: "invalid_status",
      message:
        "This signing request is still active. Retry is available only after it fails, expires, is declined, or is voided.",
    };
  }

  /* Refused before the provider is called, not after. The claim's own transition
     to `lor_sent` is gated on the policy columns in the app and in
     `public.enforce_claim_status_transition()`, and without these checks the
     database gate would fire on the UPDATE *below* — after the letter had been
     put in front of the homeowner. The order matters more than the rules: an
     unsent letter is a refusal, a sent one naming no carrier is a document that
     should never have existed. */
  const letter = await collectLorLetter(admin, claim, input.feePercent ?? null);
  if (!letter.ok) return letter;
  const { signers } = letter;

  const requestId = input.requestId ?? randomUUID();
  const ownership = await claimDispatch(admin, {
    claimId: claim.id,
    requestId,
    actorId: input.actorId ?? null,
    mode: provider.kind,
  });
  if (ownership.status === "busy") {
    return {
      ok: false,
      code: "request_in_progress",
      message: "Another signing request is already being prepared. Reload before trying again.",
    };
  }
  if (ownership.status === "duplicate") {
    return {
      ok: false,
      code: "request_already_processed",
      message: "This signing action was already processed. Reload to see its result.",
    };
  }
  if (ownership.status !== "claimed") {
    return {
      ok: false,
      code: "persist_failed",
      message: "The signing request could not be reserved. Nothing was sent.",
    };
  }
  const claimToken = ownership.token;

  let dispatch;
  try {
    dispatch = await provider.dispatchLor({
      claimId: claim.id,
      dispatchAttemptToken: claimToken,
      claimRef: claim.claim_ref,
      documentName: `LOR — ${claim.claim_ref}`,
      signers,
      tokens: letter.tokens,
      message: input.message ?? null,
      beforeSend: async (providerDocumentId) => {
        const marked = await markDispatchSending(
          admin,
          requestId,
          claimToken,
          providerDocumentId,
        );
        if (!marked) {
          throw new ESignError(
            "send_failed",
            "Signing request ownership was lost before PandaDoc send; nothing was sent.",
          );
        }
      },
    });
  } catch (error) {
    return handleDispatchFailure(admin, {
      claimId: claim.id,
      actorId: input.actorId ?? null,
      mode: provider.kind,
      requestId,
      claimToken,
      error,
    });
  }

  const transitioned = claim.status === "under_review";

  let updated: { id: string } | null = null;
  let updateMessage: string | null = null;
  try {
    await deps.beforePersist?.();
    const update = await admin
      .from("claims")
      .update({
        ...(transitioned ? { status: "lor_sent" as const } : {}),
        esign_status: dispatch.esignStatus,
        pandadoc_document_id:
          provider.kind === "manual" ? null : dispatch.providerDocumentId,
        esign_active_attempt_token:
          provider.kind === "manual" ? null : claimToken,
      })
      .eq("id", claim.id)
      .eq("esign_dispatch_token", claimToken)
      .select("id")
      .maybeSingle();
    updated = update.data;
    updateMessage = update.error?.message ?? null;
  } catch (error) {
    updateMessage = error instanceof Error ? error.message : "persistence threw";
  }

  if (updateMessage || !updated) {
    console.error("[esign] sendLor persist failed", {
      claimId: claim.id,
      message: updateMessage ?? "dispatch ownership was lost",
    });
    return {
      ok: false,
      code: "request_in_progress",
      message:
        "PandaDoc sent the letter, but confirmation could not be saved. Automatic retry is locked until a matching webhook reconciles it.",
    };
  }

  if (transitioned) {
    await admin.from("claim_status_history").insert({
      claim_id: claim.id,
      from_status: "under_review",
      to_status: "lor_sent",
      changed_by: input.actorId ?? null,
      note:
        provider.kind === "pandadoc"
          ? "Letter of Representation sent for signature via PandaDoc."
          : "Letter of Representation marked as sent (manual signing).",
    });
  }

  await admin.from("claim_events").insert({
    claim_id: claim.id,
    type: "status",
    visibility: "shared",
    author_id: input.actorId ?? null,
    body: dispatch.deliveredByProvider
      ? `Letter of Representation sent for signature to ${signers
          .map((signer) => signer.email)
          .join(" and ")}.`
      : "Letter of Representation marked as sent. Staff are delivering it outside the system.",
  });

  await writeAudit(admin, {
    actorId: input.actorId ?? null,
    action: "esign.lor_sent",
    entity: "claims",
    entityId: claim.id,
    meta: {
      mode: provider.kind,
      provider_document_id: dispatch.providerDocumentId,
      esign_status: dispatch.esignStatus,
      recipients: signers.map((signer) => signer.email),
      transitioned,
    },
  });

  const result: SendLorSuccess = {
    ok: true,
    mode: provider.kind,
    claimId: claim.id,
    claimRef: claim.claim_ref,
    providerDocumentId: dispatch.providerDocumentId,
    esignStatus: dispatch.esignStatus,
    transitioned,
    deliveredByProvider: dispatch.deliveredByProvider,
    recipients: signers.map((signer) => signer.email),
  };
  await settleDispatch(admin, requestId, claimToken, "completed", result);
  return result;
}
