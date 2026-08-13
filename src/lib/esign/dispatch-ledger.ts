import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ESignMode } from "./types";

type Admin = SupabaseClient<Database>;

export type DispatchClaim =
  | { status: "claimed"; token: string }
  | { status: "busy" | "duplicate" | "failed" };

export const ESIGN_DISPATCH_LEASE_SECONDS = 120;

export async function claimDispatch(
  admin: Admin,
  input: {
    claimId: string;
    requestId: string;
    actorId: string | null;
    mode: ESignMode;
  },
): Promise<DispatchClaim> {
  const token = randomUUID();
  const { data, error } = await admin.rpc("claim_esign_dispatch", {
    p_claim_id: input.claimId,
    p_request_id: input.requestId,
    p_claim_token: token,
    p_mode: input.mode,
    ...(input.actorId ? { p_actor_id: input.actorId } : {}),
    p_lease_seconds: ESIGN_DISPATCH_LEASE_SECONDS,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return { status: "failed" };
  }
  const status = (data as Record<string, unknown>).status;
  if (status === "claimed") return { status, token };
  if (status === "busy" || status === "duplicate") return { status };
  return { status: "failed" };
}

export async function markDispatchSending(
  admin: Admin,
  requestId: string,
  token: string,
  providerDocumentId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("mark_esign_dispatch_sending", {
    p_request_id: requestId,
    p_claim_token: token,
    p_provider_document_id: providerDocumentId,
  });
  return !error && data === true;
}

export async function settleDispatch(
  admin: Admin,
  requestId: string,
  token: string,
  state: "completed" | "failed",
  result: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await admin.rpc("settle_esign_dispatch", {
    p_request_id: requestId,
    p_claim_token: token,
    p_state: state,
    p_result: result as Json,
  });
  return !error && data === true;
}
