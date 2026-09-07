import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";
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

/** The two columns a Letter of Representation is written against. */
export type PolicyIdentity = {
  carrier: string | null;
  policy_number: string | null;
};

/**
 * Whether this claim knows whose policy it is about.
 *
 * Blank counts as absent, not as a value. `carrier` is nullable so a partner
 * referral can state that nobody was asked (see the 20260812120000 migration),
 * and the column carries no length CHECK — so `''` is reachable in principle and
 * would name a carrier no more than null does.
 *
 * Pure, and separate from the reader below, because two callers hold the row in
 * different ways: the picker has only a claim id, and `advanceClaimStatus` has
 * already read the row through `claims_select`. One definition of "present" is
 * what stops the disabled control and the action from disagreeing.
 */
export function namesAPolicy(claim: PolicyIdentity): boolean {
  return (claim.carrier ?? "").trim().length > 0 &&
    (claim.policy_number ?? "").trim().length > 0;
}

/**
 * The same question asked of a claim the caller has only the id of, through
 * their own client so `claims_select` answers it.
 *
 * Fails closed for the same reason `hasSignedLor` does: a claim this caller
 * cannot read is a claim they cannot advance, and a read that failed is not
 * evidence that a carrier is on the file.
 */
export async function claimNamesAPolicy(
  supabase: Client,
  claimId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("claims")
    .select("carrier, policy_number")
    .eq("id", claimId)
    .maybeSingle();

  if (error || !data) {
    console.error(
      "[status-machine] policy lookup failed",
      error?.message ?? "no such claim",
    );
    return false;
  }

  return namesAPolicy(data);
}

export type TransitionBlock = { to: ClaimStatus; reason: string };

/**
 * Each reason names the fix and where it is made. "Policy and carrier" is the
 * title of the panel directly below the picker on the same screen, so the
 * sentence points at something the reader can already see.
 */
export const NO_POLICY_REASON =
  "Record the carrier and the policy number under Policy and carrier on this page first. The letter is addressed to the carrier and cites the policy, so one sent without them names neither.";

export const NO_SIGNED_LOR_REASON =
  "Upload the signed letter of representation to Documents first — the file has to hold one before representation can be marked signed.";

/**
 * The moves that are legal by the status machine but blocked by a condition
 * the machine cannot express. Returned alongside the legal set so the picker
 * can render the move *and* say why it is unavailable — a control that simply
 * omits `lor_signed` teaches an adjuster nothing about what to do next, and
 * "upload the signed letter" is exactly what they need to be told.
 *
 * There are two such conditions, one per representation step, and they guard
 * the same document from opposite ends: a Letter of Representation cannot be
 * called sent while the claim names no carrier to address it to, and cannot be
 * called signed while the file holds no signed copy of it.
 *
 * The first is new because the premise it was left out on turned out to be
 * false. A partner referral carries no carrier — §6 does not ask the referring
 * rep for one — and `acceptIntake`, which collects it, is not the only door out
 * of `new_intake`: this very picker offers `new_intake → under_review`, and
 * from `under_review` the letter is one legal move away.
 *
 * At most one query runs. No status offers both moves: `under_review` offers
 * `lor_sent`, `lor_sent` offers `lor_signed`.
 */
export async function transitionBlocks(
  supabase: Client,
  claimId: string,
  allowed: readonly ClaimStatus[],
): Promise<TransitionBlock[]> {
  const blocks: TransitionBlock[] = [];

  if (allowed.includes("lor_sent") && !(await claimNamesAPolicy(supabase, claimId))) {
    blocks.push({ to: "lor_sent", reason: NO_POLICY_REASON });
  }

  if (allowed.includes("lor_signed") && !(await hasSignedLor(supabase, claimId))) {
    blocks.push({ to: "lor_signed", reason: NO_SIGNED_LOR_REASON });
  }

  return blocks;
}
