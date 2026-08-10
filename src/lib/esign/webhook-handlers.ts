import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CLAIM_DOCS_BUCKET } from "@/lib/actions/intake-storage";
import { writeAudit } from "@/lib/audit";
import { dispatchOutbox, outboxRows, staffInbox } from "@/lib/email/outbox";
import type { OutboxEntry } from "@/lib/email/outbox";
import type { Database } from "@/types/database";
import {
  actorNameFromEvent,
  creationErrorFromEvent,
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
  "property_street, property_street2, property_city, property_state, property_zip";

export type WebhookClaim = Pick<
  Database["public"]["Tables"]["claims"]["Row"],
  | "id"
  | "claim_ref"
  | "status"
  | "esign_status"
  | "pandadoc_document_id"
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
};

const propertyAddress = (claim: WebhookClaim) =>
  [
    claim.property_street,
    claim.property_street2,
    `${claim.property_city}, ${claim.property_state} ${claim.property_zip}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");

async function enqueue(admin: Admin, entries: OutboxEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const { data, error } = await admin
    .from("notifications_outbox")
    .insert(outboxRows(entries))
    .select("id");

  if (error || !data) {
    console.error("[esign] outbox enqueue failed", error?.message);
    return;
  }

  await dispatchOutbox(
    admin,
    data.map((row) => row.id),
  );
}

/**
 * Feed entries are the one side effect a re-delivery would visibly duplicate,
 * so each is written through this: same claim, same body, already present →
 * nothing happens. Every other side effect below is naturally idempotent
 * (a column set to a value it already holds, a document row guarded by an
 * existence check, a transition the status machine refuses twice).
 */
async function postFeedEventOnce(
  admin: Admin,
  claimId: string,
  entry: {
    type: Database["public"]["Enums"]["claim_event_type"];
    visibility: Database["public"]["Enums"]["claim_event_visibility"];
    body: string;
  },
): Promise<boolean> {
  const { data: existing } = await admin
    .from("claim_events")
    .select("id")
    .eq("claim_id", claimId)
    .eq("body", entry.body)
    .limit(1)
    .maybeSingle();

  if (existing) return false;

  const { error } = await admin.from("claim_events").insert({
    claim_id: claimId,
    type: entry.type,
    visibility: entry.visibility,
    body: entry.body,
  });

  if (error) throw new Error(`claim_events insert failed: ${error.message}`);
  return true;
}

/** `recipient_completed` — one signer finished. */
export async function handleRecipientCompleted(
  context: HandlerContext,
): Promise<EventOutcome> {
  const { admin, claim, event } = context;
  const who = actorNameFromEvent(event);
  const body = `${who} signed the Letter of Representation.`;

  const posted = await postFeedEventOnce(admin, claim.id, {
    type: "system",
    visibility: "shared",
    body,
  });

  if (!posted) return "ignored";

  await enqueue(admin, [
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
  ]);

  await writeAudit(admin, {
    action: "esign.recipient_completed",
    entity: "claims",
    entityId: claim.id,
    meta: { event_id: context.eventId, signer: who },
  });

  return "applied";
}

/** `document_state_changed` — mirror the provider status, flag the bad ones. */
export async function handleDocumentStateChanged(
  context: HandlerContext,
): Promise<EventOutcome> {
  const { admin, claim, event } = context;
  const status = documentStatusFromEvent(event);
  if (!status) return "ignored";
  if (claim.esign_status === status) return "ignored";

  const { error } = await admin
    .from("claims")
    .update({ esign_status: status })
    .eq("id", claim.id);

  if (error) throw new Error(`esign_status update failed: ${error.message}`);

  const failed = (PANDADOC_TERMINAL_FAILURE_STATUSES as readonly string[]).includes(status);

  if (failed) {
    const headline = `Letter of Representation ${status.replace("document.", "")}`;
    await postFeedEventOnce(admin, claim.id, {
      type: "system",
      visibility: "internal",
      body: `${headline}. The claim needs staff attention before representation can proceed.`,
    });

    await enqueue(admin, [
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
    ]);
  }

  await writeAudit(admin, {
    action: failed ? "esign.document_failed" : "esign.state_changed",
    entity: "claims",
    entityId: claim.id,
    meta: { event_id: context.eventId, esign_status: status, previous: claim.esign_status },
  });

  return "applied";
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

  const { data: existing } = await admin
    .from("documents")
    .select("id")
    .eq("claim_id", claim.id)
    .eq("kind", "lor_signed")
    .limit(1)
    .maybeSingle();

  if (!existing) {
    const bytes = await provider.downloadSignedPdf(documentId);
    if (bytes.length === 0) {
      throw new ESignError("download_failed", "PandaDoc returned an empty signed PDF");
    }

    const storagePath = `claims/${claim.id}/${crypto.randomUUID()}.pdf`;
    const { error: uploadError } = await admin.storage
      .from(CLAIM_DOCS_BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      throw new Error(`signed LOR upload failed: ${uploadError.message}`);
    }

    const { error: rowError } = await admin.from("documents").insert({
      claim_id: claim.id,
      storage_path: storagePath,
      original_name: `LOR ${claim.claim_ref} (signed).pdf`,
      kind: "lor_signed",
      mime: "application/pdf",
      size_bytes: bytes.length,
      visibility: "customer",
    });

    if (rowError) {
      await admin.storage.from(CLAIM_DOCS_BUCKET).remove([storagePath]);
      throw new Error(`signed LOR document row failed: ${rowError.message}`);
    }

    await postFeedEventOnce(admin, claim.id, {
      type: "document",
      visibility: "shared",
      body: "The signed Letter of Representation was filed against this claim.",
    });
  }

  if (claim.status === "lor_sent") {
    const { error: transitionError } = await admin
      .from("claims")
      .update({ status: "lor_signed", esign_status: "document.completed" })
      .eq("id", claim.id)
      .eq("status", "lor_sent");

    if (transitionError) {
      throw new Error(`lor_signed transition failed: ${transitionError.message}`);
    }

    await admin.from("claim_status_history").insert({
      claim_id: claim.id,
      from_status: "lor_sent",
      to_status: "lor_signed",
      note: "Signed Letter of Representation received from the e-signature provider.",
    });

    await postFeedEventOnce(admin, claim.id, {
      type: "status",
      visibility: "shared",
      body: "Representation is confirmed — the Letter of Representation is signed.",
    });

    const { data: primary } = await admin
      .from("claimants")
      .select("first_name, email")
      .eq("claim_id", claim.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

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

    await enqueue(admin, entries);
  }

  await writeAudit(admin, {
    action: "esign.lor_signed",
    entity: "claims",
    entityId: claim.id,
    meta: {
      event_id: context.eventId,
      provider_document_id: documentId,
      reused_existing_document: Boolean(existing),
    },
  });

  return "applied";
}

/** `document_creation_failed` — async creation blew up; staff need the detail. */
export async function handleCreationFailed(
  context: HandlerContext,
): Promise<EventOutcome> {
  const { admin, claim, event } = context;
  const detail = creationErrorFromEvent(event) ?? "PandaDoc did not say why.";

  const { error } = await admin
    .from("claims")
    .update({ esign_status: "document.creation_failed" })
    .eq("id", claim.id);

  if (error) throw new Error(`esign_status update failed: ${error.message}`);

  const posted = await postFeedEventOnce(admin, claim.id, {
    type: "system",
    visibility: "internal",
    body: `The e-signature provider could not create the Letter of Representation: ${detail}`,
  });

  if (posted) {
    await enqueue(admin, [
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
    ]);
  }

  await writeAudit(admin, {
    action: "esign.creation_failed",
    entity: "claims",
    entityId: claim.id,
    meta: { event_id: context.eventId, detail },
  });

  return "applied";
}
