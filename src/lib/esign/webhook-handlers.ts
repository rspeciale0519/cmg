import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLAIM_DOCS_BUCKET } from "@/lib/actions/intake-storage";
import { staffInbox } from "@/lib/email/outbox";
import { registerCleanupIntent, removeOrQueueExact } from "@/lib/storage-cleanup";
import type { OutboxEntry } from "@/lib/email/outbox";
import type { Database } from "@/types/database-app";
import {
  enqueueWebhookNotifications as enqueue,
  postFeedEventOnce,
  propertyAddress,
  writeWebhookAudit,
} from "./webhook-effects";
import { WEBHOOK_PDF_DOWNLOAD_TIMEOUT_MS } from "./webhook-timing";
import {
  actorNameFromEvent,
  actorIdentityFromEvent,
  creationErrorFromEvent,
  dispatchAttemptTokenForRpc,
  documentIdFromEvent,
  documentStatusFromEvent,
} from "./payload";
import {
  ESignError,
  PANDADOC_TERMINAL_FAILURE_STATUSES,
  type ESignProvider,
  type EventOutcome,
  type PandaDocWebhookEvent,
} from "./types";

type Admin = SupabaseClient<Database>;

export const WEBHOOK_CLAIM_COLUMNS =
  "id, claim_ref, status, esign_status, pandadoc_document_id, " +
  "esign_active_attempt_token, esign_dispatch_token, " +
  "property_street, property_street2, property_city, property_state, property_zip";

export type WebhookClaim = Pick<
  Database["public"]["Tables"]["claims"]["Row"],
  | "id"
  | "claim_ref"
  | "status"
  | "esign_status"
  | "pandadoc_document_id"
  | "esign_active_attempt_token"
  | "esign_dispatch_token"
  | "property_street"
  | "property_street2"
  | "property_city"
  | "property_state"
  | "property_zip"
>;

export type HandlerContext = {
  admin: Admin;
  provider: ESignProvider;
  claim: WebhookClaim;
  event: PandaDocWebhookEvent;
  eventId: string;
  effectId?: string;
  beforeEnqueue?: () => Promise<void>;
  beforeAudit?: () => Promise<void>;
  downloadTimeoutMs?: number;
};

async function downloadPdf(
  provider: ESignProvider,
  documentId: string,
  timeoutMs: number,
): Promise<Uint8Array> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new ESignError("download_failed", "Signed PDF download timed out")),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([provider.downloadSignedPdf(documentId), expired]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** `recipient_completed` — one signer finished. */
export async function handleRecipientCompleted(
  context: HandlerContext,
): Promise<EventOutcome> {
  const { admin, claim, event } = context;
  const who = actorNameFromEvent(event);
  const body = `${who} signed the Letter of Representation.`;

  /* PandaDoc's recipient event still reports the document itself as `sent`,
     which used to leave the admin screen claiming only that the request had
     gone out after a homeowner had already signed it. Keep a local, explicit
     milestone until the provider advances the document to completed. */
  const documentId = documentIdFromEvent(event) ?? claim.pandadoc_document_id;
  if (!documentId) return "ignored";
  const recipientHash = createHash("sha256")
    .update(`${documentId}:${actorIdentityFromEvent(event)}`)
    .digest("hex");
  const { data: completion, error: completionError } = await admin.rpc(
    "record_esign_recipient_completion",
    {
      p_claim_id: claim.id,
      p_document_id: documentId,
      p_attempt_token: dispatchAttemptTokenForRpc(event),
      p_recipient_hash: recipientHash,
    },
  );
  if (completionError) {
    throw new Error(`recipient completion persist failed: ${completionError.message}`);
  }
  if (
    !completion ||
    typeof completion !== "object" ||
    Array.isArray(completion) ||
    (completion as Record<string, unknown>).status !== "recorded"
  ) return "ignored";

  const posted = await postFeedEventOnce(admin, claim.id, {
    type: "system",
    visibility: "shared",
    body,
  }, `${context.effectId ?? context.eventId}:recipient-feed`);

  await enqueue(admin, context.effectId ?? context.eventId, [
    {
      recipientEmail: staffInbox(),
      message: {
        template: "esign_staff_alert",
        payload: {
          claimRef: claim.claim_ref,
          headline: `${who} signed the Letter of Representation`,
          detail: body,
          esignStatus: documentStatusFromEvent(event) ?? undefined,
        },
      },
    },
  ], context.beforeEnqueue);

  await context.beforeAudit?.();
  await writeWebhookAudit(admin, {
    action: "esign.recipient_completed",
    entity: "claims",
    entityId: claim.id,
    meta: { event_id: context.eventId, signer: who },
  }, context.effectId ?? context.eventId);

  return posted ? "applied" : "ignored";
}

/** `document_state_changed` — mirror the provider status, flag the bad ones. */
export async function handleDocumentStateChanged(
  context: HandlerContext,
): Promise<EventOutcome> {
  const { admin, claim, event } = context;
  const status = documentStatusFromEvent(event);
  if (!status) return "ignored";
  const documentId = documentIdFromEvent(event) ?? claim.pandadoc_document_id;
  if (!documentId) return "ignored";
  const { data: stateOutcome, error: stateError } = await admin.rpc(
    "apply_esign_webhook_state",
    {
      p_claim_id: claim.id,
      p_document_id: documentId,
      p_attempt_token: dispatchAttemptTokenForRpc(event),
      p_status: status,
    },
  );
  if (stateError) throw new Error(`esign_status update failed: ${stateError.message}`);
  if (stateOutcome === "stale") return "ignored";
  const changed = stateOutcome === "applied";

  const failed = (PANDADOC_TERMINAL_FAILURE_STATUSES as readonly string[]).includes(status);

  if (failed) {
    const headline = `Letter of Representation ${status.replace("document.", "")}`;
    await postFeedEventOnce(admin, claim.id, {
      type: "system",
      visibility: "internal",
      body: `${headline}. The claim needs staff attention before representation can proceed.`,
    }, `${context.effectId ?? context.eventId}:terminal-failure-feed`);

    await enqueue(admin, context.effectId ?? context.eventId, [
      {
        recipientEmail: staffInbox(),
        message: {
          template: "esign_staff_alert",
          payload: {
            claimRef: claim.claim_ref,
            headline,
            detail:
              "The e-signature request will not complete on its own. Re-send the letter or arrange a manual signature.",
            esignStatus: status,
          },
        },
      },
    ], context.beforeEnqueue);
  }

  await context.beforeAudit?.();
  await writeWebhookAudit(admin, {
    action: failed ? "esign.document_failed" : "esign.state_changed",
    entity: "claims",
    entityId: claim.id,
    meta: { event_id: context.eventId, esign_status: status, previous: claim.esign_status },
  }, context.effectId ?? context.eventId);

  return changed ? "applied" : "ignored";
}

/**
 * `document_completed_pdf_ready` — the sealed PDF exists. Pull it through
 * `/download-protected`, file it against the claim, then let the status machine
 * take `lor_sent → lor_signed` (the gate it enforces is precisely the document
 * row written a few lines above).
 */
export async function handlePdfReady(context: HandlerContext): Promise<EventOutcome> {
  const { admin, claim, provider, event } = context;

  const documentId = documentIdFromEvent(event) ?? claim.pandadoc_document_id;
  if (!documentId) return "ignored";
  const attemptToken = dispatchAttemptTokenForRpc(event);
  const { data: active, error: activeError } = await admin.rpc(
    "esign_attempt_is_active",
    {
      p_claim_id: claim.id,
      p_document_id: documentId,
      p_attempt_token: attemptToken,
    },
  );
  if (activeError) throw new Error(`e-sign attempt check failed: ${activeError.message}`);
  if (!active) return "ignored";

  const bytes = await downloadPdf(
    provider,
    documentId,
    context.downloadTimeoutMs ?? WEBHOOK_PDF_DOWNLOAD_TIMEOUT_MS,
  );
  if (bytes.length === 0) {
    throw new ESignError("download_failed", "PandaDoc returned an empty signed PDF");
  }

  const effectId = context.effectId ?? context.eventId;
  const storagePath = `claims/${claim.id}/pandadoc-${effectId}.pdf`;
  if (!(await registerCleanupIntent(admin, CLAIM_DOCS_BUCKET, storagePath, claim.id))) {
    throw new Error("signed LOR cleanup intent could not be saved");
  }
  const { error: uploadError } = await admin.storage
    .from(CLAIM_DOCS_BUCKET)
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  const reusedObject = uploadError?.message.toLowerCase().includes("already exists") ?? false;
  if (uploadError && !reusedObject) {
    throw new Error(`signed LOR upload failed: ${uploadError.message}`);
  }

  const { data: finalized, error: finalizeError } = await admin.rpc(
    "finalize_esign_pdf",
    {
      p_claim_id: claim.id,
      p_document_id: documentId,
      p_attempt_token: attemptToken,
      p_external_event_key: `${effectId}:signed-pdf`,
      p_storage_path: storagePath,
      p_original_name: `LOR ${claim.claim_ref} (signed).pdf`,
      p_size_bytes: bytes.length,
    },
  );
  if (finalizeError || !finalized || typeof finalized !== "object" || Array.isArray(finalized)) {
    if (!reusedObject) await removeOrQueueExact(admin, CLAIM_DOCS_BUCKET, [storagePath], claim.id);
    throw new Error(`signed LOR finalization failed: ${finalizeError?.message ?? "invalid result"}`);
  }
  if ((finalized as Record<string, unknown>).status !== "recorded") {
    if (!reusedObject) await removeOrQueueExact(admin, CLAIM_DOCS_BUCKET, [storagePath], claim.id);
    return "ignored";
  }

  await postFeedEventOnce(admin, claim.id, {
    type: "document",
    visibility: "shared",
    body: "The signed Letter of Representation was filed against this claim.",
  }, `${effectId}:document-feed`);

  const { data: history, error: historyLookupError } = await admin
    .from("claim_status_history")
    .select("id")
    .eq("claim_id", claim.id)
    .eq("from_status", "lor_sent")
    .eq("to_status", "lor_signed")
    .limit(1)
    .maybeSingle();
  if (historyLookupError) {
    throw new Error(`status history lookup failed: ${historyLookupError.message}`);
  }
  if (!history) {
    const { error: historyError } = await admin.from("claim_status_history").insert({
      claim_id: claim.id,
      from_status: "lor_sent",
      to_status: "lor_signed",
      note: "Signed Letter of Representation received from the e-signature provider.",
    });
    if (historyError) throw new Error(`status history insert failed: ${historyError.message}`);
  }

  await postFeedEventOnce(admin, claim.id, {
    type: "status",
    visibility: "shared",
    body: "Representation is confirmed — the Letter of Representation is signed.",
  }, `${effectId}:status-feed`);

  const { data: primary, error: claimantError } = await admin
    .from("claimants")
    .select("first_name, email")
    .eq("claim_id", claim.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (claimantError) throw new Error(`primary claimant lookup failed: ${claimantError.message}`);

  const entries: OutboxEntry[] = [
      {
        recipientEmail: staffInbox(),
        message: {
          template: "esign_staff_alert",
          payload: {
            claimRef: claim.claim_ref,
            headline: "Letter of Representation signed",
            detail: "The sealed PDF is filed against the claim; it is now at lor_signed.",
            esignStatus: "document.completed",
          },
        },
      },
  ];

  if (primary?.email) {
    entries.push({
        recipientEmail: primary.email,
        message: {
          template: "lor_signed",
          payload: {
            firstName: primary.first_name,
            claimRef: claim.claim_ref,
            propertyAddress: propertyAddress(claim),
          },
        },
    });
  }

  await enqueue(admin, context.effectId ?? context.eventId, entries, context.beforeEnqueue);

  await context.beforeAudit?.();
  await writeWebhookAudit(admin, {
    action: "esign.lor_signed",
    entity: "claims",
    entityId: claim.id,
    meta: {
      event_id: context.eventId,
      provider_document_id: documentId,
      reused_storage_object: reusedObject,
    },
  }, context.effectId ?? context.eventId);

  return "applied";
}

/** `document_creation_failed` — async creation blew up; staff need the detail. */
export async function handleCreationFailed(
  context: HandlerContext,
): Promise<EventOutcome> {
  const { admin, claim, event } = context;
  const detail = creationErrorFromEvent(event) ?? "PandaDoc did not say why.";
  const documentId = documentIdFromEvent(event) ?? claim.pandadoc_document_id;
  if (!documentId) return "ignored";
  const { data: stateOutcome, error } = await admin.rpc(
    "apply_esign_webhook_state",
    {
      p_claim_id: claim.id,
      p_document_id: documentId,
      p_attempt_token: dispatchAttemptTokenForRpc(event),
      p_status: "document.creation_failed",
    },
  );
  if (error) throw new Error(`esign_status update failed: ${error.message}`);
  if (stateOutcome === "stale") return "ignored";

  const posted = await postFeedEventOnce(admin, claim.id, {
    type: "system",
    visibility: "internal",
    body: `The e-signature provider could not create the Letter of Representation: ${detail}`,
  }, `${context.effectId ?? context.eventId}:creation-failed-feed`);

  await enqueue(admin, context.effectId ?? context.eventId, [
      {
        recipientEmail: staffInbox(),
        message: {
          template: "esign_staff_alert",
          payload: {
            claimRef: claim.claim_ref,
            headline: "Letter of Representation could not be created",
            detail,
            esignStatus: "document.creation_failed",
          },
        },
      },
  ], context.beforeEnqueue);

  await context.beforeAudit?.();
  await writeWebhookAudit(admin, {
    action: "esign.creation_failed",
    entity: "claims",
    entityId: claim.id,
    meta: { event_id: context.eventId, detail },
  }, context.effectId ?? context.eventId);

  return posted ? "applied" : "ignored";
}
