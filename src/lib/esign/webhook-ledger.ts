import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { WEBHOOK_LEASE_SECONDS } from "./webhook-timing";

type Admin = SupabaseClient<Database>;

export type WebhookClaim =
  | { status: "claimed"; token: string }
  | { status: "duplicate" | "busy" | "conflict" | "failed" };

export async function claimWebhookEvent(
  admin: Admin,
  eventId: string,
  payloadHash: string,
): Promise<WebhookClaim> {
  const token = crypto.randomUUID();
  const { data, error } = await admin.rpc("claim_pandadoc_webhook_event", {
    p_event_id: eventId,
    p_payload_hash: payloadHash,
    p_claim_token: token,
    p_lease_seconds: WEBHOOK_LEASE_SECONDS,
  });

  if (error) {
    console.error("[pandadoc-webhook] event claim failed", error.message);
    return { status: "failed" };
  }

  const status =
    data && typeof data === "object" && !Array.isArray(data) && "status" in data
      ? data.status
      : null;
  if (status === "claimed") return { status, token };
  if (status === "duplicate" || status === "busy" || status === "conflict") {
    return { status };
  }

  console.error("[pandadoc-webhook] event claim returned an invalid result", data);
  return { status: "failed" };
}

export async function completeWebhookEvent(
  admin: Admin,
  eventId: string,
  token: string,
  summary: Json,
): Promise<boolean> {
  const { data, error } = await admin.rpc("complete_pandadoc_webhook_event", {
    p_event_id: eventId,
    p_claim_token: token,
    p_payload_summary: summary,
  });

  if (error || !data) {
    console.error("[pandadoc-webhook] event completion failed", error?.message);
    return false;
  }

  return true;
}

export async function releaseWebhookEvent(
  admin: Admin,
  eventId: string,
  token: string,
  error: string,
): Promise<void> {
  const { error: releaseError } = await admin.rpc("release_pandadoc_webhook_event", {
    p_event_id: eventId,
    p_claim_token: token,
    p_error: error,
  });

  if (releaseError) {
    console.error("[pandadoc-webhook] event release failed", releaseError.message);
  }
}
