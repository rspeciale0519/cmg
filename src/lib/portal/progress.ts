import {
  CUSTOMER_PHASE,
  customerPhaseFor,
  type ClaimStatus,
  type CustomerPhase,
} from "@/lib/claims/status";

/**
 * The homeowner's view of the lifecycle. Spec §5 defines the five-step mapping
 * and `src/lib/claims/status.ts` already holds it — `customerPhaseFor()` is
 * imported rather than re-derived, so the phase the admin sees on a claim and
 * the phase the homeowner is shown are the same function's answer. A second
 * mapping here would be a second thing to keep in step, and the one that drifted
 * would be the one the homeowner reads.
 *
 * What this file adds is everything the mapping does not carry: what each stage
 * *is* in a sentence, what is happening right now, and what happens next —
 * written for someone with water coming through their ceiling rather than for a
 * spec reader. `STATUS_MEANING` in the claims module is the staff voice of the
 * same facts ("Waiting on triage. Nobody is assigned yet.") and is deliberately
 * not reused: "nobody is assigned yet" is a reasonable thing for an adjuster to
 * read on a queue and a frightening thing for a homeowner to read about their
 * own claim.
 */

export type StageState = "done" | "current" | "upcoming";

/** One rung of the ladder, as the portal renders it. */
export type ProgressStage = {
  phase: CustomerPhase;
  state: StageState;
  /** What the stage is, in a sentence. Present tense for the current one. */
  summary: string;
  /**
   * When the claim first reached this stage, from `claim_status_history`, or
   * null for a stage it has not reached. A stage that is `done` with no date is
   * possible and honest: a claim imported at `filed` never had the earlier
   * transitions written, and inventing a date for one is worse than a dash.
   */
  reachedAt: string | null;
};

export type ProgressView = {
  stages: ProgressStage[];
  /** 0-based index into `stages`, for "Step N of 5". */
  currentIndex: number;
  /** What is happening now, keyed on the real status rather than the phase. */
  now: string;
  /** What happens next, and who does it. */
  next: string;
  /**
   * True when the next move is the homeowner's rather than CMG's or the
   * carrier's. Exactly one status sets it — `lor_sent` — and the overview
   * raises the stage from a statement to a request when it does.
   */
  awaitingHomeowner: boolean;
};

const STAGE_SUMMARY: Record<CustomerPhase, string> = {
  Received: "Your claim is with us and someone is reading it.",
  Representation:
    "The letter that lets us deal with your carrier on your behalf.",
  Documenting:
    "Photographs, measurements and pricing that prove what the storm did.",
  "With carrier":
    "Your claim is filed and we are working the carrier's response.",
  Resolved: "Agreed with the carrier, with payment and closeout to follow.",
};

/**
 * Two sentences per status: what is true today, and what moves next. Keyed on
 * the real status rather than the phase, because the four statuses that share
 * "With carrier" are four genuinely different situations — a claim that has just
 * been filed and a claim the carrier has denied are not the same news, and
 * showing one sentence for both is how a portal becomes something a homeowner
 * stops opening.
 *
 * `rejected` is absent. `customerPhaseFor()` answers null for it, spec §5 says
 * no invite is ever sent, and the overview handles a phase-less claim on its own
 * rather than pretending there is a rung to stand on.
 */
const STATUS_NARRATIVE: Record<
  Exclude<ClaimStatus, "rejected">,
  { now: string; next: string }
> = {
  new_intake: {
    now: "Your claim is in the queue. There is nothing you need to do yet.",
    next: "We read the file and call you within one business day.",
  },
  under_review: {
    now: "One of our adjusters is going through your file now.",
    next: "If we can help, we send you a letter of representation to sign.",
  },
  lor_sent: {
    now: "The letter of representation is with you for signature.",
    next: "Sign it and we can start dealing with your carrier for you.",
  },
  lor_signed: {
    now: "Signed. We now represent you and your carrier deals with us.",
    next: "We inspect the property and start building the evidence file.",
  },
  documenting: {
    now: "We are photographing, measuring and pricing the damage.",
    next: "We file the completed claim with your carrier.",
  },
  filed: {
    now: "Your claim is with the carrier and their response clock is running.",
    next: "They assign a field adjuster, and we meet them at your property.",
  },
  negotiating: {
    now: "We are working through the carrier's numbers line by line.",
    next: "They put an offer on the table, or we escalate.",
  },
  settlement_offered: {
    now: "The carrier has made an offer. We are checking it covers the whole loss.",
    next: "We will call you before anything is agreed.",
  },
  denied: {
    now: "The carrier has refused the claim. That is not the end of it.",
    next: "We reopen the claim with the evidence that answers their reason.",
  },
  reopened: {
    now: "The claim is back with the carrier after the refusal.",
    next: "They review it again and we press for a decision.",
  },
  settled: {
    now: "Agreed with the carrier.",
    next: "Payment is issued and the file closes.",
  },
  closed: {
    now: "This claim is finished.",
    next: "Nothing further is needed. We keep the file on record.",
  },
};

export type StatusHistoryRow = {
  to_status: string;
  created_at: string;
};

/**
 * The first time the claim reached each phase.
 *
 * *First*, not last, and the distinction is the whole reason this is a function
 * rather than a lookup: a claim that goes `filed → negotiating →
 * settlement_offered` crosses "With carrier" three times, and a claim that is
 * denied and reopened crosses it twice more. The date a homeowner means by "when
 * did it go to the carrier" is the first one.
 *
 * Rows are not assumed sorted — the caller reads them newest-first for the
 * timeline and this walks them in whatever order they arrive, keeping the
 * earliest per phase.
 */
export function phaseDates(
  history: readonly StatusHistoryRow[],
): Partial<Record<CustomerPhase, string>> {
  const dates: Partial<Record<CustomerPhase, string>> = {};

  for (const row of history) {
    const phase = customerPhaseFor(row.to_status as ClaimStatus);
    if (!phase) continue;

    const held = dates[phase];
    if (!held || row.created_at < held) dates[phase] = row.created_at;
  }

  return dates;
}

/**
 * The whole ladder, ready to render.
 *
 * A stage's state is decided by its position against the current phase and
 * nothing else — specifically not by whether it has a date. `denied` sits in
 * "With carrier", which is index 3, so the two stages behind it stay `done`
 * while the claim is in trouble: they *did* happen, and greying out
 * "Representation" because the carrier said no would tell the homeowner they had
 * lost something they still have.
 *
 * Returns null for a status with no customer phase (`rejected`), which the
 * caller renders as its own thing rather than as an empty ladder.
 */
export function progressFor(
  status: ClaimStatus,
  history: readonly StatusHistoryRow[],
): ProgressView | null {
  const phase = customerPhaseFor(status);
  if (!phase) return null;

  const currentIndex = CUSTOMER_PHASE.indexOf(phase);
  const dates = phaseDates(history);
  const narrative = STATUS_NARRATIVE[status as Exclude<ClaimStatus, "rejected">];

  const stages: ProgressStage[] = CUSTOMER_PHASE.map((name, index) => ({
    phase: name,
    state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    /* `settled` and `closed` share the Resolved rung, and the shared summary was
       written for `settled` alone — so a closed claim read "Agreed with the
       carrier, with payment and closeout to follow." one line above "This claim
       is finished. Nothing further is needed." The rung promised a payment the
       narrative had just said was done. A finished file gets the finished
       wording. */
    summary:
      name === "Resolved" && status === "closed"
        ? "Agreed with the carrier, paid, and closed."
        : STAGE_SUMMARY[name],
    reachedAt: dates[name] ?? null,
  }));

  return {
    stages,
    currentIndex,
    now: narrative.now,
    next: narrative.next,
    awaitingHomeowner: status === "lor_sent",
  };
}
