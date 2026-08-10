import type { PandaDocWebhookEvent } from "./types";

/**
 * Defensive readers for webhook payloads. Every one of these returns a value
 * or `null`; none throws. A webhook body is attacker-shaped input right up
 * until the HMAC check passes, and even afterwards it is a third party's JSON
 * whose shape changes when they ship — a handler that throws on an unexpected
 * field turns a cosmetic API change into a 500 and, three failures later, a
 * deactivated subscription.
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function asUuid(value: unknown): string | null {
  const text = asString(value);
  return text !== null && UUID.test(text) ? text : null;
}

/** `null` when the body is not JSON, or is JSON that is not an event array. */
export function parseWebhookEvents(rawBody: string): PandaDocWebhookEvent[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const events: PandaDocWebhookEvent[] = [];
  for (const entry of parsed) {
    const record = asRecord(entry);
    if (!record) continue;
    const event = asString(record.event);
    if (!event) continue;
    events.push({ event, data: asRecord(record.data) ?? {} });
  }

  return events;
}

export function claimIdFromEvent(event: PandaDocWebhookEvent): string | null {
  const metadata = asRecord(event.data.metadata);
  return metadata ? asUuid(metadata.claim_id) : null;
}

export function documentIdFromEvent(event: PandaDocWebhookEvent): string | null {
  return asString(event.data.id);
}

export function documentStatusFromEvent(event: PandaDocWebhookEvent): string | null {
  return asString(event.data.status);
}

/** `data.error.detail` — the validation message from a failed async creation. */
export function creationErrorFromEvent(event: PandaDocWebhookEvent): string | null {
  const error = asRecord(event.data.error);
  if (error) {
    return asString(error.detail) ?? asString(error.message) ?? asString(error.type);
  }
  return asString(event.data.error);
}

/** Best available human name for whoever completed a signature. */
export function actorNameFromEvent(event: PandaDocWebhookEvent): string {
  const actor = asRecord(event.data.action_by);
  if (actor) {
    const name = [asString(actor.first_name), asString(actor.last_name)]
      .filter((part): part is string => part !== null)
      .join(" ");
    if (name.length > 0) return name;
    const email = asString(actor.email);
    if (email) return email;
  }
  return "A signer";
}

/** A short, non-PII summary kept on the dedupe row for support triage. */
export function payloadSummary(
  events: PandaDocWebhookEvent[],
): Record<string, unknown> {
  return {
    count: events.length,
    events: events.slice(0, 10).map((event) => ({
      event: event.event,
      document_id: documentIdFromEvent(event),
      status: documentStatusFromEvent(event),
      claim_id: claimIdFromEvent(event),
    })),
  };
}
