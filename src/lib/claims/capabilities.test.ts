import { describe, expect, it } from "vitest";
import { canAcceptIntake, claimCapabilities } from "./capabilities";

const OWNER = { userId: "user-owner", role: "owner" as const };
const ADJUSTER = { userId: "user-adjuster", role: "adjuster" as const };
const OTHER_ADJUSTER = { userId: "user-other", role: "adjuster" as const };
const ASSISTANT = { userId: "user-assistant", role: "assistant" as const };

const ASSIGNED = { assignedAdjusterId: "user-adjuster" };
const UNASSIGNED = { assignedAdjusterId: null };

/**
 * These mirror `private.can_manage_claim()` and the §4 access matrix. They are
 * a rendering contract, not a security one — RLS decides what actually lands —
 * but a drift here shows an assistant a status picker that is always refused,
 * or hides a money panel from the adjuster it belongs to.
 */
describe("claimCapabilities", () => {
  it("gives an owner everything on any claim", () => {
    const can = claimCapabilities(OWNER, UNASSIGNED);
    expect(can.canManage).toBe(true);
    expect(can.canSeeFinancials).toBe(true);
    expect(can.canPostShared).toBe(true);
    expect(can.canUploadRepresentation).toBe(true);
    expect(can.isOwner).toBe(true);
  });

  it("gives the assigned adjuster management of their own claim", () => {
    const can = claimCapabilities(ADJUSTER, ASSIGNED);
    expect(can.canManage).toBe(true);
    expect(can.canSeeFinancials).toBe(true);
    expect(can.isOwner).toBe(false);
  });

  it("gives an adjuster nothing on a claim assigned to someone else", () => {
    const can = claimCapabilities(OTHER_ADJUSTER, ASSIGNED);
    expect(can.canManage).toBe(false);
    expect(can.canSeeFinancials).toBe(false);
    expect(can.canPostShared).toBe(false);
    expect(can.canUploadRepresentation).toBe(false);
  });

  it("gives an adjuster nothing on an unassigned claim", () => {
    // `private.is_assigned_adjuster()` compares against
    // `assigned_adjuster_id`, and NULL is not anybody — an unassigned claim is
    // nobody's to manage but the owner's.
    const can = claimCapabilities(ADJUSTER, UNASSIGNED);
    expect(can.canManage).toBe(false);
  });

  it("lets an assistant write notes but never money, status or partner disclosures", () => {
    const can = claimCapabilities(ASSISTANT, ASSIGNED);
    expect(can.canPostNote).toBe(true);
    expect(can.canUploadDocuments).toBe(true);
    expect(can.canManage).toBe(false);
    expect(can.canSeeFinancials).toBe(false);
    expect(can.canPostShared).toBe(false);
    expect(can.canUploadRepresentation).toBe(false);
  });

  it("keeps financial visibility identical to management authority", () => {
    // §4 lists them as separate rows and they happen to coincide;
    // asserting the equality means a future divergence has to be deliberate.
    for (const actor of [OWNER, ADJUSTER, OTHER_ADJUSTER, ASSISTANT]) {
      for (const claim of [ASSIGNED, UNASSIGNED]) {
        const can = claimCapabilities(actor, claim);
        expect(can.canSeeFinancials).toBe(can.canManage);
      }
    }
  });
});

describe("canAcceptIntake", () => {
  it("is the owner's move alone", () => {
    // Accepting assigns an adjuster and advances the status on a claim that has
    // none, so `can_manage_claim()` reduces to `is_owner()` in the database and
    // no other role can complete the flow however much of it they can see.
    expect(canAcceptIntake(OWNER)).toBe(true);
    expect(canAcceptIntake(ADJUSTER)).toBe(false);
    expect(canAcceptIntake(ASSISTANT)).toBe(false);
  });
});
