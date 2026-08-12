import { describe, expect, it } from "vitest";
import { ALL_STATUSES, CUSTOMER_PHASE } from "@/lib/claims/status";
import { phaseDates, progressFor, type StatusHistoryRow } from "./progress";

const row = (to_status: string, created_at: string): StatusHistoryRow => ({
  to_status,
  created_at,
});

/** The seeded claim 1's real history, which crosses "With carrier" three times. */
const CLAIM_ONE: StatusHistoryRow[] = [
  row("new_intake", "2026-05-22T13:14:00Z"),
  row("under_review", "2026-05-23T12:40:00Z"),
  row("lor_sent", "2026-05-24T20:02:00Z"),
  row("lor_signed", "2026-05-26T18:05:00Z"),
  row("documenting", "2026-05-27T13:00:00Z"),
  row("filed", "2026-06-09T14:20:00Z"),
  row("negotiating", "2026-06-25T17:45:00Z"),
  row("settlement_offered", "2026-07-14T15:00:00Z"),
];

describe("phaseDates", () => {
  it("keeps the first time each phase was reached, not the last", () => {
    const dates = phaseDates(CLAIM_ONE);

    // `filed`, `negotiating` and `settlement_offered` all map to "With
    // carrier". The date a homeowner means by "when did it go to the carrier"
    // is the first of the three.
    expect(dates["With carrier"]).toBe("2026-06-09T14:20:00Z");
    expect(dates.Received).toBe("2026-05-22T13:14:00Z");
    expect(dates.Representation).toBe("2026-05-24T20:02:00Z");
    expect(dates.Documenting).toBe("2026-05-27T13:00:00Z");
  });

  it("does not depend on the rows arriving in order", () => {
    const shuffled = [...CLAIM_ONE].reverse();
    expect(phaseDates(shuffled)).toEqual(phaseDates(CLAIM_ONE));
  });

  it("still reports the first crossing after a denial and a reopen", () => {
    const history = [
      ...CLAIM_ONE,
      row("denied", "2026-08-01T12:00:00Z"),
      row("reopened", "2026-08-05T12:00:00Z"),
    ];

    expect(phaseDates(history)["With carrier"]).toBe("2026-06-09T14:20:00Z");
  });

  it("leaves a phase absent when nothing has reached it", () => {
    expect(phaseDates(CLAIM_ONE).Resolved).toBeUndefined();
  });

  it("skips a status that maps to no customer phase", () => {
    const dates = phaseDates([
      row("new_intake", "2026-01-01T00:00:00Z"),
      row("rejected", "2026-01-02T00:00:00Z"),
    ]);

    expect(Object.keys(dates)).toEqual(["Received"]);
  });

  it("ignores a to_status that is not a claim status at all", () => {
    expect(phaseDates([row("nonsense", "2026-01-01T00:00:00Z")])).toEqual({});
  });
});

describe("progressFor", () => {
  it("puts settlement_offered on the fourth rung with the first three done", () => {
    const progress = progressFor("settlement_offered", CLAIM_ONE);

    expect(progress).not.toBeNull();
    expect(progress!.currentIndex).toBe(3);
    expect(progress!.stages.map((stage) => stage.state)).toEqual([
      "done",
      "done",
      "done",
      "current",
      "upcoming",
    ]);
  });

  it("keeps the earlier stages done when the carrier denies the claim", () => {
    // A denial is bad news about the current stage, not a retraction of the
    // representation the homeowner still has. Greying out "Representation"
    // would tell them they had lost something they had not.
    const progress = progressFor("denied", [
      ...CLAIM_ONE,
      row("denied", "2026-08-01T12:00:00Z"),
    ]);

    expect(progress!.currentIndex).toBe(3);
    expect(progress!.stages.slice(0, 3).every((s) => s.state === "done")).toBe(true);
  });

  it("marks lor_sent as the one status waiting on the homeowner", () => {
    for (const status of ALL_STATUSES) {
      if (status === "rejected") continue;
      const progress = progressFor(status, []);
      expect(progress!.awaitingHomeowner).toBe(status === "lor_sent");
    }
  });

  it("returns null for a rejected intake rather than an empty ladder", () => {
    expect(progressFor("rejected", CLAIM_ONE)).toBeNull();
  });

  it("gives every reachable status a now and a next sentence", () => {
    for (const status of ALL_STATUSES) {
      if (status === "rejected") continue;

      const progress = progressFor(status, []);
      expect(progress, status).not.toBeNull();
      expect(progress!.now.length, status).toBeGreaterThan(0);
      expect(progress!.next.length, status).toBeGreaterThan(0);
    }
  });

  it("always returns the five phases in spec order", () => {
    const progress = progressFor("new_intake", []);
    expect(progress!.stages.map((stage) => stage.phase)).toEqual([...CUSTOMER_PHASE]);
  });

  it("carries a null date for a stage with no history row", () => {
    // A claim imported straight in at `filed` never had the earlier
    // transitions written. A dash is honest; an invented date is not.
    const progress = progressFor("filed", [row("filed", "2026-06-09T14:20:00Z")]);

    expect(progress!.stages[0].reachedAt).toBeNull();
    expect(progress!.stages[3].reachedAt).toBe("2026-06-09T14:20:00Z");
  });

  it("marks every stage done except the last when a claim closes", () => {
    const progress = progressFor("closed", CLAIM_ONE);

    expect(progress!.currentIndex).toBe(4);
    expect(progress!.stages.map((stage) => stage.state)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "current",
    ]);
  });
});
