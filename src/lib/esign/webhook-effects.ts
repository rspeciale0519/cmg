import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditEvent } from "@/lib/audit";
import { outboxRows } from "@/lib/email/outbox";
import type { OutboxEntry } from "@/lib/email/outbox";
import type { Database, Json } from "@/types/database";

type Admin = SupabaseClient<Database>;

type AddressClaim = Pick<
  Database["public"]["Tables"]["claims"]["Row"],
  "property_street" | "property_street2" | "property_city" | "property_state" | "property_zip"
>;

export const propertyAddress = (claim: AddressClaim) =>
  [
    claim.property_street,
    claim.property_street2,
    `${claim.property_city}, ${claim.property_state} ${claim.property_zip}`,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");

export async function writeWebhookAudit(
  admin: Admin,
  input: AuditEvent,
  eventId: string,
): Promise<void> {
  const { data, error } = await admin
    .from("audit_log")
    .select("id")
    .eq("action", input.action)
    .eq("entity_id", input.entityId ?? "00000000-0000-0000-0000-000000000000")
    .contains("meta", { _effect_id: eventId })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`webhook audit lookup failed: ${error.message}`);
  if (data) return;

  const { error: insertError } = await admin.from("audit_log").insert({
    actor_id: input.actorId ?? null,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    meta: { ...(input.meta ?? {}), _effect_id: eventId } as Json,
    ip: input.ip ?? null,
  });
  if (insertError) throw new Error(`webhook audit insert failed: ${insertError.message}`);
}

export async function enqueueWebhookNotifications(
  admin: Admin,
  eventId: string,
  entries: OutboxEntry[],
  beforeEnqueue?: () => Promise<void>,
): Promise<void> {
  if (entries.length === 0) return;
  await beforeEnqueue?.();

  const { error } = await admin
    .from("notifications_outbox")
    .upsert(
      outboxRows(entries.map((entry) => ({
        ...entry,
        dedupeKey: `${eventId}:${entry.message.template}:${entry.recipientEmail.toLowerCase()}`,
      }))),
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );

  if (error) throw new Error(`esign outbox enqueue failed: ${error.message}`);
}

export async function postFeedEventOnce(
  admin: Admin,
  claimId: string,
  entry: {
    type: Database["public"]["Enums"]["claim_event_type"];
    visibility: Database["public"]["Enums"]["claim_event_visibility"];
    body: string;
  },
  externalEventKey?: string,
): Promise<boolean> {
  if (externalEventKey) {
    const { data, error } = await admin
      .from("claim_events")
      .upsert(
        {
          claim_id: claimId,
          type: entry.type,
          visibility: entry.visibility,
          body: entry.body,
          external_event_key: externalEventKey,
        },
        { onConflict: "external_event_key", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw new Error(`claim_events insert failed: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }

  const { data: existing, error: existingError } = await admin
    .from("claim_events")
    .select("id")
    .eq("claim_id", claimId)
    .eq("body", entry.body)
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(`claim_events lookup failed: ${existingError.message}`);
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
