import { describe, expect, it } from "vitest";
import {
  ALL_STATUSES,
  BRANCH_STATUSES,
  customerPhaseFor,
  isClaimStatus,
  PIPELINE,
  pipelineIndex,
  STATUS_LABEL,
  STATUS_MEANING,
  STATUS_TONE,
  type ClaimStatus,
} from "./status";

/**
 * The enum these tests pin is `public.claim_status`, written out here on
 * purpose rather than derived from the module under test. Deriving it would
 * make every assertion below vacuous: a status dropped from the module would
 * also drop from the expectation and the suite would stay green while the UI
 * lost a stage. This list has to be updated by hand when the migration changes,
 * which is the point — it is the tripwire between the two.
 */
const DB_STATUSES = [
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
  "denied",
  "reopened",
  "rejected",
] as const;

describe("claim status vocabulary", () => {
  it("labels and explains every value of public.claim_status", () => {
    for (const status of DB_STATUSES) {
      expect(STATUS_LABEL[status], `label for ${status}`).toBeTruthy();
      expect(STATUS_MEANING[status], `meaning for ${status}`).toBeTruthy();
      expect(STATUS_TONE[status], `tone for ${status}`).toBeTruthy();
    }
  });

  it("covers the database enum exactly — no extras, no gaps", () => {
    expect([...ALL_STATUSES].sort()).toEqual([...DB_STATUSES].sort());
  });

  it("keeps the branch statuses off the mainline", () => {
    for (const status of BRANCH_STATUSES) {
      expect(PIPELINE).not.toContain(status);
      expect(pipelineIndex(status)).toBe(-1);
    }
  });

  it("orders the pipeline as spec §5 states it", () => {
    expect(PIPELINE).toEqual([
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
    ]);
  });

  it("recognises real statuses and refuses anything else", () => {
    expect(isClaimStatus("filed")).toBe(true);
    expect(isClaimStatus("Filed")).toBe(false);
    expect(isClaimStatus("")).toBe(false);
    expect(isClaimStatus(null)).toBe(false);
    expect(isClaimStatus(undefined)).toBe(false);
    // `toString` is on Object.prototype, so a naive `value in map` check without
    // a own-property guard would accept it.
    expect(isClaimStatus("toString")).toBe(false);
  });
});

describe("customer phase mapping (spec §5)", () => {
  const cases: [ClaimStatus, string | null][] = [
    ["new_intake", "Received"],
    ["under_review", "Received"],
    ["lor_sent", "Representation"],
    ["lor_signed", "Representation"],
    ["documenting", "Documenting"],
    ["filed", "With carrier"],
    ["negotiating", "With carrier"],
    ["settlement_offered", "With carrier"],
    ["denied", "With carrier"],
    ["reopened", "With carrier"],
    ["settled", "Resolved"],
    ["closed", "Resolved"],
    ["rejected", null],
  ];

  it.each(cases)("maps %s to %s", (status, phase) => {
    expect(customerPhaseFor(status)).toBe(phase);
  });

  it("gives a rejected intake no phase at all", () => {
    // A declined intake never produced a portal account, so there is nobody to
    // show a phase to — `null` rather than a "None" string the UI would print.
    expect(customerPhaseFor("rejected")).toBeNull();
  });
});
