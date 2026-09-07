import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/email/outbox", () => ({
  outboxRows: () => [],
  dispatchOutbox: async () => undefined,
}));

const { visibilityForStatus } = await import("./record-transition");
const { ALL_STATUSES } = await import("./status");

/**
 * Spec §5: "visibility `shared` for milestone statuses, `customer` otherwise".
 * Getting this wrong is a disclosure bug in one direction and a silent
 * customer in the other, and neither announces itself in the UI.
 */
describe("visibilityForStatus", () => {
  it("shares the four milestones plus a denial with the referring partner", () => {
    for (const status of ["lor_signed", "filed", "settled", "closed", "denied"] as const) {
      expect(visibilityForStatus(status), status).toBe("shared");
    }
  });

  it("keeps ordinary progress between CMG and the homeowner", () => {
    for (const status of [
      "under_review",
      "lor_sent",
      "documenting",
      "negotiating",
      "settlement_offered",
      "reopened",
      "new_intake",
    ] as const) {
      expect(visibilityForStatus(status), status).toBe("customer");
    }
  });

  it("keeps a declined intake internal", () => {
    // §6: a rejected intake never produced a portal account, so there is nobody
    // on the other side to read a feed entry — and an email would tell somebody
    // they had been declined by a firm they may not have heard back from at all.
    expect(visibilityForStatus("rejected")).toBe("internal");
  });

  it("assigns a visibility to every status in the enum", () => {
    for (const status of ALL_STATUSES) {
      expect(["internal", "customer", "partner", "shared"]).toContain(
        visibilityForStatus(status),
      );
    }
  });

  it("never discloses to a partner alone", () => {
    // `partner`-only is a legitimate visibility for a hand-written note, but a
    // status change the homeowner cannot see while their contractor can would
    // be the wrong way round for every status in the lifecycle.
    for (const status of ALL_STATUSES) {
      expect(visibilityForStatus(status), status).not.toBe("partner");
    }
  });
});
