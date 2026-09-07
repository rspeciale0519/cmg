import type { Database } from "@/types/database-app";

export type ClaimStatus = Database["public"]["Enums"]["claim_status"];

/**
 * Display vocabulary for the lifecycle, and nothing else. The *legality* of a
 * move is not stated anywhere in this file and must not be: spec §5 puts that
 * in `public.allowed_claim_transitions()`, a second copy in TypeScript is a
 * copy that drifts, and the one that drifts is always the one the UI trusts.
 * `src/lib/claims/transitions.ts` reads the real thing.
 */
export const STATUS_LABEL: Record<ClaimStatus, string> = {
  new_intake: "New intake",
  under_review: "Under review",
  lor_sent: "LOR sent",
  lor_signed: "LOR signed",
  documenting: "Documenting",
  filed: "Filed",
  negotiating: "Negotiating",
  settlement_offered: "Settlement offered",
  settled: "Settled",
  closed: "Closed",
  denied: "Denied",
  reopened: "Reopened",
  rejected: "Rejected",
};

/**
 * What each status means for the file, written for a staff member scanning a
 * queue rather than for a spec reader. One sentence, present tense, says who
 * holds the next move.
 */
export const STATUS_MEANING: Record<ClaimStatus, string> = {
  new_intake: "Waiting on triage. Nobody is assigned yet.",
  under_review: "Assigned and being assessed before representation is offered.",
  lor_sent: "Letter of representation is out for signature.",
  lor_signed: "CMG represents this homeowner. Evidence gathering can start.",
  documenting: "Building the loss file — photos, estimates, declarations.",
  filed: "Submitted to the carrier. Waiting on their first response.",
  negotiating: "Working the carrier's position.",
  settlement_offered: "An offer is on the table and needs a decision.",
  settled: "Agreed. Payment and closeout remain.",
  closed: "Finished. No further moves.",
  denied: "The carrier refused. Reopening is the only way forward.",
  reopened: "Back with the carrier after a denial.",
  /* "…and no invite was ever sent" was true of the intake queue, whose reject
     action is pinned to `status = 'new_intake'`, and false of the status picker,
     which `allowed_claim_transitions` also offers at `under_review` and
     `lor_sent`. A homeowner on either of those may already hold a portal account
     — the dashboard's invite panel excludes only `new_intake` and `rejected`,
     and `issueClaimantInvite` carries no status gate. The sentence is shown as a
     preview of the move and then permanently on the file, so it asserted
     something the workspace cannot check. */
  rejected: "CMG declined this intake. Archived, and no further moves are possible.",
};

/**
 * The mainline sequence a healthy claim walks, in order. `denied`, `reopened`
 * and `rejected` are deliberately absent: they are branches off this line, not
 * points on it, and drawing them inline would tell an adjuster that a denial
 * sits between two ordinary stages.
 */
export const PIPELINE: readonly ClaimStatus[] = [
  "new_intake",
  "under_review",
  "lor_sent",
  "lor_signed",
  "documenting",
  "filed",
  "negotiating",
  "settlement_offered",
  "settled",
  "closed",
] as const;

/** Off the mainline. Counted and shown apart from the ladder. */
export const BRANCH_STATUSES: readonly ClaimStatus[] = [
  "denied",
  "reopened",
  "rejected",
] as const;

export const ALL_STATUSES: readonly ClaimStatus[] = [
  ...PIPELINE,
  ...BRANCH_STATUSES,
] as const;

/**
 * Colour families, kept small so the table reads at a glance. `attention` is the
 * accent gold and is spent on exactly the two statuses where someone at CMG
 * holds the next move: an intake nobody owns, and an offer nobody has answered.
 * Two, and the file's own test pins the number — if half the lifecycle wore gold
 * the colour would carry no information and the table would read as uniformly
 * urgent, which is the same as uniformly calm.
 *
 * `reopened` used to wear it and does not, because it fails that test. "Back
 * with the carrier after a denial" is the carrier's move, not CMG's — the same
 * sentence `filed` and `negotiating` carry — so it is `active` with them. It was
 * also the more expensive half of the mistake: `settlement_offered` ("an offer
 * is on the table and needs a decision") and `reopened` ("back with the carrier")
 * are opposite ends of a negotiation and were rendering as the same pill.
 *

 * A tone is a category and the label is the identity, which is why `settled`
 * and `closed` share `resolved` without confusing anyone: they are the same
 * kind of ending and the words tell you which one.
 *
 * `denied` and `rejected` were sharing `halted` on that reasoning and it did not
 * hold, because they are not the same kind of thing at all. A denial is the
 * carrier refusing a claim CMG represents — an adverse event on a live file,
 * with a next move (reopen) and a homeowner waiting on it. A rejection is CMG
 * declining an intake: nothing was ever represented, no invite was sent, and
 * there is no next move. Reading a queue, the difference decides whether a row
 * is work or archive, and giving both the same alarm colour made the branch
 * column say "something went wrong here" about files where nothing had.
 *
 * So `declined` is a fifth tone rather than a fifth hue: no fill, a hairline
 * border and quiet text — the treatment `dismissed` already carries on the leads
 * table, which is the same act one surface earlier. `halted`'s warm red stays
 * with `denied` alone, which is now the only status that wears it and therefore
 * the only one it can mean.
 */
export type StatusTone = "attention" | "active" | "resolved" | "halted" | "declined";

export const STATUS_TONE: Record<ClaimStatus, StatusTone> = {
  new_intake: "attention",
  under_review: "active",
  lor_sent: "active",
  lor_signed: "active",
  documenting: "active",
  filed: "active",
  negotiating: "active",
  settlement_offered: "attention",
  settled: "resolved",
  closed: "resolved",
  denied: "halted",
  reopened: "active",
  rejected: "declined",
};

/**
 * `Object.hasOwn`, not `in`. `in` walks the prototype chain, so `"toString"`,
 * `"constructor"` and `"hasOwnProperty"` all answered true — and this function
 * is what `parseClaimFilters()` trusts before putting a value into
 * `.eq("status", …)`. A URL of `?status=toString` therefore reached PostgREST
 * as an invalid enum literal and came back a 400 instead of an empty list,
 * which is a different response shape for a hand-typed query string.
 */
export function isClaimStatus(value: unknown): value is ClaimStatus {
  return typeof value === "string" && Object.hasOwn(STATUS_LABEL, value);
}

/** Position on the mainline, or -1 for the three branch statuses. */
export function pipelineIndex(status: ClaimStatus): number {
  return PIPELINE.indexOf(status);
}

export function statusLabel(status: ClaimStatus): string {
  return STATUS_LABEL[status];
}

/**
 * Spec §5's five-step customer mapping. Staff surfaces show the real status;
 * this exists so the admin can see the same coarse phase the homeowner is
 * being shown in their portal and not talk past them on the phone.
 */
export const CUSTOMER_PHASE = [
  "Received",
  "Representation",
  "Documenting",
  "With carrier",
  "Resolved",
] as const;

export type CustomerPhase = (typeof CUSTOMER_PHASE)[number];

export function customerPhaseFor(status: ClaimStatus): CustomerPhase | null {
  switch (status) {
    case "new_intake":
    case "under_review":
      return "Received";
    case "lor_sent":
    case "lor_signed":
      return "Representation";
    case "documenting":
      return "Documenting";
    case "filed":
    case "negotiating":
    case "settlement_offered":
    case "denied":
    case "reopened":
      return "With carrier";
    case "settled":
    case "closed":
      return "Resolved";
    // A rejected intake never became a claim the homeowner can see, so it has
    // no phase rather than a phase of "none".
    case "rejected":
      return null;
  }
}
