import type { Database } from "@/types/database";

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
  rejected: "CMG declined this intake. Archived, and no invite was ever sent.",
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
 * Colour families, kept to four so the table reads at a glance. `attention`
 * is the accent gold and is spent only where a human has to act; if more than
 * one status wore it the colour would stop meaning anything.
 */
export type StatusTone = "attention" | "active" | "resolved" | "halted";

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
  reopened: "attention",
  rejected: "halted",
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
