import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";
import { readESignConfig } from "./config";
import {
  asUuid,
  claimIdFromEvent,
  documentIdFromEvent,
  parseWebhookEvents,
  payloadSummary,
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
};

const UNIQUE_VIOLATION = "23505";

const HANDLERS: Record<string, (context: HandlerContext) => Promise<EventOutcome>> = {
  recipient_completed: handleRecipientCompleted,
  document_state_changed: handleDocumentStateChanged,
  document_completed_pdf_ready: handlePdfReady,
  document_creation_failed: handleCreationFailed,
};

async function resolveClaim(
  admin: Admin,
  event: PandaDocWebhookEvent,
): Promise<WebhookClaim | null> {
  const claimId = claimIdFromEvent(event);
  if (claimId) {
    const { data } = await admin
      .from("claims")
      .select(WEBHOOK_CLAIM_COLUMNS)
      .eq("id", claimId)
      .maybeSingle<WebhookClaim>();
    if (data) return data;
  }

  const documentId = documentIdFromEvent(event);
  if (documentId) {
    const { data } = await admin
      .from("claims")
      .select(WEBHOOK_CLAIM_COLUMNS)
      .eq("pandadoc_document_id", documentId)
      .maybeSingle<WebhookClaim>();
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
 *   3. dedupe on `X-PandaDoc-Webhook-Event-Id` by insert-if-absent against the
 *      unique primary key of `pandadoc_webhook_events`. A duplicate returns
 *      success and does nothing; a missing header is rejected;
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

  const { error: dedupeError } = await admin
    .from("pandadoc_webhook_events")
    .insert({ event_id: eventId });

  if (dedupeError) {
    if (dedupeError.code === UNIQUE_VIOLATION) {
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    console.error("[pandadoc-webhook] dedupe insert failed", dedupeError.message);
    return { status: 500, body: { ok: false, reason: "dedupe_failed" } };
  }

  const events = parseWebhookEvents(input.rawBody);
  if (events === null) {
    console.error("[pandadoc-webhook] payload was not a JSON event array");
    return { status: 200, body: { ok: true, reason: "unparseable_payload" } };
  }

  await admin
    .from("pandadoc_webhook_events")
    .update({ payload_summary: payloadSummary(events) as Json })
    .eq("event_id", eventId);

  const provider = deps.provider ?? createESignProvider();
  const counts = { applied: 0, ignored: 0, failed: 0 };

  for (const event of events) {
    const handler = HANDLERS[event.event];
    if (!handler) {
      console.info("[pandadoc-webhook] no handler for event", { event: event.event });
      counts.ignored += 1;
      continue;
    }

    const claim = await resolveClaim(admin, event);
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

    try {
      const outcome = await handler({ admin, provider, claim, event, eventId });
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
    /* Release the dedupe marker so PandaDoc's automatic retry can have another
       go: every handler above is idempotent, so re-applying the events that
       did succeed costs nothing, and the ones that did not get a second
       chance. 500 is what triggers that retry; 410 — the one status that would
       deactivate the subscription outright — is never returned from here. */
    await admin.from("pandadoc_webhook_events").delete().eq("event_id", eventId);
    return { status: 500, body: { ok: false, reason: "handler_failed", ...counts } };
  }

  return { status: 200, body: { ok: true, ...counts } };
}
