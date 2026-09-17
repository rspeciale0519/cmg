import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import { dispatchOutbox } from "@/lib/email/outbox";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database-app";
import { readESignConfig } from "./config";
import {
  asUuid,
  claimIdFromEvent,
  dispatchAttemptTokenFromEvent,
  documentIdFromEvent,
  parseWebhookEvents,
  payloadSummary,
  documentStatusFromEvent,
} from "./payload";
import { createESignProvider } from "./provider";
import { verifyWebhookSignature } from "./signature";
import type { ESignProvider, EventOutcome, PandaDocWebhookEvent, WebhookOutcome } from "./types";
import {
  handleCreationFailed,
  handleDocumentStateChanged,
  handlePdfReady,
  handleRecipientCompleted,
  WEBHOOK_CLAIM_COLUMNS,
  type HandlerContext,
  type WebhookClaim,
} from "./webhook-handlers";
import {
  claimWebhookEvent,
  completeWebhookEvent,
  releaseWebhookEvent,
} from "./webhook-ledger";
import { writeWebhookAudit } from "./webhook-effects";
import { classifyWebhookAttempt } from "./webhook-attempt";

type Admin = SupabaseClient<Database>;

export const WEBHOOK_EVENT_ID_HEADER = "x-pandadoc-webhook-event-id";
export const WEBHOOK_SIGNATURE_PARAM = "signature";

export type ProcessWebhookInput = {
  /** The body exactly as received. Parsing before this point breaks the HMAC. */
  rawBody: string;
  signature: string | null;
  eventId: string | null;
  ip?: string | null;
};

export type ProcessWebhookDeps = {
  admin?: Admin;
  provider?: ESignProvider;
  sharedKey?: string | null;
  /** Fault-injection seam used to prove that a process death leaves a reclaimable lease. */
  afterClaim?: () => Promise<void>;
  beforeEnqueue?: () => Promise<void>;
  beforeAudit?: () => Promise<void>;
  downloadTimeoutMs?: number;
};

const HANDLERS: Record<string, (context: HandlerContext) => Promise<EventOutcome>> = {
  recipient_completed: handleRecipientCompleted,
  document_state_changed: handleDocumentStateChanged,
  document_completed_pdf_ready: handlePdfReady,
  document_creation_failed: handleCreationFailed,
};

const DELIVERED_STATUSES = new Set([
  "document.sent",
  "document.viewed",
  "document.completed",
]);

function reconciliationOutcome(
  event: PandaDocWebhookEvent,
): "delivered" | "creation_failed" | "non_proving" {
  if (event.event === "document_creation_failed") return "creation_failed";
  if (
    event.event === "recipient_completed" ||
    event.event === "document_completed_pdf_ready" ||
    DELIVERED_STATUSES.has(documentStatusFromEvent(event) ?? "")
  ) return "delivered";
  return "non_proving";
}

async function resolveClaim(
  admin: Admin,
  event: PandaDocWebhookEvent,
): Promise<WebhookClaim | null> {
  const claimId = claimIdFromEvent(event);
  if (claimId) {
    const { data, error } = await admin
      .from("claims")
      .select(WEBHOOK_CLAIM_COLUMNS)
      .eq("id", claimId)
      .maybeSingle<WebhookClaim>();
    if (error) throw new Error(`claim lookup failed: ${error.message}`);
    if (data) return data;
  }

  const documentId = documentIdFromEvent(event);
  if (documentId) {
    const { data, error } = await admin
      .from("claims")
      .select(WEBHOOK_CLAIM_COLUMNS)
      .eq("pandadoc_document_id", documentId)
      .maybeSingle<WebhookClaim>();
    if (error) throw new Error(`claim document lookup failed: ${error.message}`);
    if (data) return data;
  }

  return null;
}

/**
 * The PandaDoc webhook pipeline, in the only order that is safe
 * (docs/reference/pandadoc/04-webhooks.md, blueprint §"Webhook route"):
 *
 *   1. raw body — never parsed first, or the HMAC is computed over different
 *      bytes than the ones that were signed;
 *   2. verify HMAC-SHA256 of that raw body against `?signature=`, timing-safe.
 *      Failure is a security event: logged, audited, 403, nothing processed;
 *   3. claim `X-PandaDoc-Webhook-Event-Id` through a database lease. Completed
 *      events are duplicates, concurrent work is retried, and a crashed worker
 *      becomes reclaimable rather than looking complete forever;
 *   4. parse the array and resolve the claim from `data.metadata.claim_id`,
 *      falling back to `claims.pandadoc_document_id`;
 *   5. apply each event idempotently;
 *   6. answer in well under the 20 s read timeout.
 *
 * It never returns 410 under any circumstance: PandaDoc reads 410 as "this
 * endpoint is gone" and permanently deactivates the subscription.
 */
export async function processPandaDocWebhook(
  input: ProcessWebhookInput,
  deps: ProcessWebhookDeps = {},
): Promise<WebhookOutcome> {
  const sharedKey =
    deps.sharedKey !== undefined ? deps.sharedKey : readESignConfig().webhookSharedKey;

  if (!verifyWebhookSignature(sharedKey, input.rawBody, input.signature)) {
    console.warn("[pandadoc-webhook] signature rejected", {
      ip: input.ip ?? null,
      bodyBytes: input.rawBody.length,
      signaturePresent: Boolean(input.signature),
      sharedKeyConfigured: Boolean(sharedKey),
    });

    try {
      const admin = deps.admin ?? createAdminClient();
      await writeAudit(admin, {
        action: "esign.webhook_signature_rejected",
        entity: "pandadoc_webhook",
        meta: {
          signature_present: Boolean(input.signature),
          shared_key_configured: Boolean(sharedKey),
          body_bytes: input.rawBody.length,
        },
        ip: input.ip ?? null,
      });
    } catch (error) {
      console.error("[pandadoc-webhook] could not audit the rejection", error);
    }

    return { status: 403, body: { ok: false, reason: "invalid_signature" } };
  }

  const eventId = asUuid(input.eventId);
  if (!eventId) {
    console.warn("[pandadoc-webhook] missing or malformed event id header");
    return { status: 400, body: { ok: false, reason: "missing_event_id" } };
  }

  const admin = deps.admin ?? createAdminClient();

  const payloadHash = createHash("sha256").update(input.rawBody).digest("hex");
  const claim = await claimWebhookEvent(admin, eventId, payloadHash);
  if (claim.status === "duplicate") {
    return { status: 200, body: { ok: true, duplicate: true } };
  }
  if (claim.status === "busy") {
    return { status: 503, body: { ok: false, reason: "event_processing" } };
  }
  if (claim.status === "conflict") {
    console.error("[pandadoc-webhook] event id reused with a different payload", { eventId });
    return { status: 409, body: { ok: false, reason: "event_id_conflict" } };
  }
  if (claim.status === "failed") {
    return { status: 500, body: { ok: false, reason: "dedupe_failed" } };
  }
  if (claim.status !== "claimed") {
    return { status: 500, body: { ok: false, reason: "dedupe_failed" } };
  }

  await deps.afterClaim?.();

  const events = parseWebhookEvents(input.rawBody);
  if (events === null) {
    console.error("[pandadoc-webhook] payload was not a JSON event array");
    const completed = await completeWebhookEvent(admin, eventId, claim.token, {
      malformed: true,
      body_bytes: input.rawBody.length,
    });
    if (!completed) {
      return { status: 500, body: { ok: false, reason: "completion_failed" } };
    }
    return { status: 200, body: { ok: true, reason: "unparseable_payload" } };
  }

  const provider = deps.provider ?? createESignProvider();
  const counts = { applied: 0, ignored: 0, failed: 0 };

  for (const [eventIndex, event] of events.entries()) {
    const effectId = events.length === 1 ? eventId : `${eventId}:${eventIndex}`;
    /* Own-property check, same reason as src/lib/validators/files.ts and
       src/lib/claims/status.ts. `event.event` is a string lifted straight out of
       the request body, so `HANDLERS["constructor"]` and `HANDLERS["toString"]`
       both returned a truthy function, skipped the "no handler" branch below,
       and were then *called* as handlers — `counts[outcome] += 1` turned into
       NaN under an `[object Object]` key in the 200 response, and
       `__defineGetter__` threw, which deletes the dedupe row and makes PandaDoc
       retry the same payload forever. HMAC verification upstream means this
       needs the shared secret, so it is a robustness fix rather than a hole; the
       sibling module src/lib/email/render.tsx already does it this way. */
    const handler = Object.hasOwn(HANDLERS, event.event)
      ? HANDLERS[event.event]
      : undefined;
    if (!handler) {
      console.info("[pandadoc-webhook] no handler for event", { event: event.event });
      counts.ignored += 1;
      continue;
    }

    let resolvedClaim: WebhookClaim | null = null;
    try {
      resolvedClaim = await resolveClaim(admin, event);
    } catch (error) {
      counts.failed += 1;
      console.error("[pandadoc-webhook] claim lookup threw", error);
      continue;
    }
    let claim = resolvedClaim;
    if (!claim) {
      /* Not a failure: an event for a claim we do not have is permanent, and
         retrying it forever would only hammer the endpoint. */
      console.warn("[pandadoc-webhook] no claim for event", {
        event: event.event,
        documentId: documentIdFromEvent(event),
      });
      counts.ignored += 1;
      continue;
    }

    const eventDocumentId = documentIdFromEvent(event);
    const eventAttemptToken = dispatchAttemptTokenFromEvent(event);
    const attempt = classifyWebhookAttempt(
      {
        esignStatus: claim.esign_status,
        currentDocumentId: claim.pandadoc_document_id,
        activeAttemptToken: claim.esign_active_attempt_token,
        dispatchToken: claim.esign_dispatch_token,
      },
      { documentId: eventDocumentId, attemptToken: eventAttemptToken },
    );
    const exactInFlight =
      eventAttemptToken !== null &&
      eventDocumentId !== null &&
      claim.esign_dispatch_token === eventAttemptToken &&
      claim.esign_active_attempt_token === eventAttemptToken &&
      claim.pandadoc_document_id === eventDocumentId;
    if (attempt === "dispatch_in_flight" && !exactInFlight) {
      counts.failed += 1;
      continue;
    }
    if (attempt === "stale") {
      /* Metadata identifies the business record, not the live request. After a
         retry, the superseded document still carries the same claim id and can
         emit late viewed/declined/completed events. Treating it as current can
         undo the retry or file the wrong signed PDF. */
      await writeWebhookAudit(admin, {
        action: "esign.stale_webhook_ignored",
        entity: "claims",
        entityId: claim.id,
        meta: {
          event_id: eventId,
          event: event.event,
          stale_document_id: eventDocumentId,
          current_document_id: claim.pandadoc_document_id,
          stale_attempt_token: eventAttemptToken,
          current_attempt_token: claim.esign_active_attempt_token,
        },
      }, effectId);
      counts.ignored += 1;
      continue;
    }

    if (
      eventAttemptToken !== null &&
      eventDocumentId !== null &&
      exactInFlight
    ) {
      const outcome = reconciliationOutcome(event);
      const { data: reconciled, error: reconcileError } = await admin.rpc(
        "reconcile_esign_dispatch",
        {
          p_claim_id: claim.id,
          p_document_id: eventDocumentId,
          p_attempt_token: eventAttemptToken,
          p_outcome: outcome,
        },
      );
      if (reconcileError || reconciled === "mismatch" || reconciled === "invalid_outcome") {
        counts.failed += 1;
        continue;
      }
      if (reconciled === "retained") {
        counts.ignored += 1;
        continue;
      }
      const refreshed = await resolveClaim(admin, event);
      if (!refreshed) {
        counts.failed += 1;
        continue;
      }
      claim = refreshed;
    }

    try {
      const outcome = await handler({
        admin,
        provider,
        claim,
        event,
        eventId,
        effectId,
        beforeEnqueue: deps.beforeEnqueue,
        beforeAudit: deps.beforeAudit,
        downloadTimeoutMs: deps.downloadTimeoutMs,
      });
      counts[outcome] += 1;
    } catch (error) {
      counts.failed += 1;
      console.error("[pandadoc-webhook] handler threw", {
        event: event.event,
        claimId: claim.id,
        message: error instanceof Error ? error.message : String(error),
      });
      await writeAudit(admin, {
        action: "esign.webhook_handler_failed",
        entity: "claims",
        entityId: claim.id,
        meta: {
          event_id: eventId,
          event: event.event,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  if (counts.failed > 0) {
    await releaseWebhookEvent(admin, eventId, claim.token, `${counts.failed} handler(s) failed`);
    return { status: 500, body: { ok: false, reason: "handler_failed", ...counts } };
  }

  const completed = await completeWebhookEvent(
    admin,
    eventId,
    claim.token,
    payloadSummary(events) as Json,
  );
  if (!completed) {
    return { status: 500, body: { ok: false, reason: "completion_failed", ...counts } };
  }

  /* After the event is marked complete, not before: delivery is best-effort
     and must never turn a processed event back into a retry. Every other
     enqueue site dispatches immediately after its commit, and a signed letter
     is the one notification a homeowner is actively waiting for — without this
     it would wait for the next daily sweep. Rows are found by the dedupe key
     the handlers stamped, so only this event's messages are attempted. */
  await dispatchWebhookNotifications(admin, eventId);

  return { status: 200, body: { ok: true, ...counts } };
}

async function dispatchWebhookNotifications(admin: Admin, eventId: string): Promise<void> {
  try {
    const { data, error } = await admin
      .from("notifications_outbox")
      .select("id")
      .like("dedupe_key", `${eventId}:%`)
      .eq("status", "pending");
    if (error || !data || data.length === 0) return;
    await dispatchOutbox(admin, data.map((row) => row.id));
  } catch (cause) {
    console.error("[pandadoc-webhook] immediate dispatch failed", cause);
  }
}
