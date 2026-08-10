import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isClaimStatus, type ClaimStatus } from "./status";

type Client = SupabaseClient<Database>;

/**
 * The legal next moves, read from `public.allowed_claim_transitions()` — the
 * same function `public.enforce_claim_status_transition()` consults before it
 * lets an UPDATE through.
 *
 * One source, asked over the wire, rather than a mirrored table in TypeScript.
 * A mirror is cheaper per request and wrong the first time anyone edits the
 * lifecycle in SQL without editing this file: the picker would then offer a
 * move the trigger refuses (a dead control), or hide one it permits (a
 * capability that silently disappears). Neither failure announces itself. The
 * function is `immutable` and takes one enum argument, so the round trip is a
 * planner-cached constant lookup on a connection the page has already opened.
 *
 * Fails closed. An RPC error yields no moves at all, which renders as a status
 * that cannot be advanced — the safe direction for a control whose whole job
 * is to constrain what may happen to a file.
 */
export async function legalTransitions(
  supabase: Client,
  from: ClaimStatus,
): Promise<ClaimStatus[]> {
  const { data, error } = await supabase.rpc("allowed_claim_transitions", {
    p_from: from,
  });

  if (error) {
    console.error("[status-machine] allowed_claim_transitions failed", error.message);
    return [];
  }

  return (data ?? []).filter(isClaimStatus);
}

/**
 * Authoritative membership test for a proposed move, asked the same way and of
 * the same function. Server actions call this before writing so a refusal
 * arrives as a sentence rather than as a raised Postgres exception — the
 * trigger still refuses underneath either way, which is the point of §5's
 * double enforcement.
 */
export async function isLegalTransition(
  supabase: Client,
  from: ClaimStatus,
  to: ClaimStatus,
): Promise<boolean> {
  const allowed = await legalTransitions(supabase, from);
  return allowed.includes(to);
}

/**
 * Spec §5's one gate that is not expressible as a pair of statuses:
 * `lor_sent → lor_signed` requires a `documents` row of kind `lor_signed` on
 * the claim.
 *
 * Asked through the caller's own client, so RLS answers it. That matters more
 * than it looks: `documents_select` scopes an adjuster to assigned claims, so
 * this cannot be used to probe for the existence of a document on someone
 * else's file, and a caller who could not see the document could not have
 * performed the transition anyway.
 */
export async function hasSignedLor(
  supabase: Client,
  claimId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("claim_id", claimId)
    .eq("kind", "lor_signed")
    .limit(1);

  if (error) {
    console.error("[status-machine] lor_signed lookup failed", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export type TransitionBlock = { to: ClaimStatus; reason: string };

/**
 * The moves that are legal by the status machine but blocked by a condition
 * the machine cannot express. Returned alongside the legal set so the picker
 * can render the move *and* say why it is unavailable — a control that simply
 * omits `lor_signed` teaches an adjuster nothing about what to do next, and
 * "upload the signed letter" is exactly what they need to be told.
 */
export async function transitionBlocks(
  supabase: Client,
  claimId: string,
  allowed: readonly ClaimStatus[],
): Promise<TransitionBlock[]> {
  if (!allowed.includes("lor_signed")) return [];
  if (await hasSignedLor(supabase, claimId)) return [];

  return [
    {
      to: "lor_signed",
      reason:
        "Upload the signed letter of representation to Documents first — the file has to hold one before representation can be marked signed.",
    },
  ];
}
