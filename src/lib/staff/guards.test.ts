import { describe, expect, it } from "vitest";
import {
  activeOwnersAfter,
  isStaffAppRole,
  strandsWorkspace,
  type RosterEntry,
} from "./guards";

const OWNER_A: RosterEntry = { id: "a", role: "owner", isActive: true };
const OWNER_B: RosterEntry = { id: "b", role: "owner", isActive: true };
const OWNER_INACTIVE: RosterEntry = { id: "c", role: "owner", isActive: false };
const ADJUSTER: RosterEntry = { id: "d", role: "adjuster", isActive: true };
const ASSISTANT: RosterEntry = { id: "e", role: "assistant", isActive: true };

describe("strandsWorkspace", () => {
  it("refuses the last active owner deactivating themselves", () => {
    expect(
      strandsWorkspace([OWNER_A, ADJUSTER, ASSISTANT], {
        targetId: "a",
        nextActive: false,
      }),
    ).toBe(true);
  });

  it("refuses the last active owner demoting themselves", () => {
    // The hole self-deactivation alone would miss. An owner who becomes an
    // adjuster is still active, so an is_active-only check would wave it
    // through — and guard_profile_privileges() would then refuse every attempt
    // to put the role back, because there is no active owner left to ask.
    expect(
      strandsWorkspace([OWNER_A, ADJUSTER], { targetId: "a", nextRole: "adjuster" }),
    ).toBe(true);
  });

  it("allows deactivation while a second active owner remains", () => {
    expect(
      strandsWorkspace([OWNER_A, OWNER_B], { targetId: "a", nextActive: false }),
    ).toBe(false);
  });

  it("does not count a deactivated owner as cover", () => {
    // The trap this exists to catch: an owner who sees two owner rows and
    // assumes one of them can take over. A deactivated owner cannot act at all,
    // so they are not a second owner for this purpose.
    expect(
      strandsWorkspace([OWNER_A, OWNER_INACTIVE], { targetId: "a", nextActive: false }),
    ).toBe(true);
  });

  it("allows deactivating a non-owner regardless of the owner count", () => {
    expect(
      strandsWorkspace([OWNER_A, ADJUSTER], { targetId: "d", nextActive: false }),
    ).toBe(false);
  });

  it("allows a promotion that adds an owner", () => {
    expect(
      strandsWorkspace([OWNER_A, ADJUSTER], { targetId: "d", nextRole: "owner" }),
    ).toBe(false);
  });

  it("refuses demoting the last owner even when someone else is promoted separately", () => {
    // Two changes are two requests. Each one is judged against the roster as it
    // stands, so the demotion is refused until the promotion has actually
    // landed — which is the correct order and the safe one.
    expect(
      strandsWorkspace([OWNER_A, ADJUSTER], { targetId: "a", nextRole: "assistant" }),
    ).toBe(true);
  });

  it("treats a simultaneous role and activation change as one outcome", () => {
    expect(
      strandsWorkspace([OWNER_A, OWNER_B], {
        targetId: "b",
        nextRole: "adjuster",
        nextActive: false,
      }),
    ).toBe(false);

    expect(
      strandsWorkspace([OWNER_A], {
        targetId: "a",
        nextRole: "owner",
        nextActive: false,
      }),
    ).toBe(true);
  });

  it("reactivating a deactivated owner is never refused", () => {
    expect(
      strandsWorkspace([OWNER_INACTIVE, ADJUSTER], {
        targetId: "c",
        nextActive: true,
      }),
    ).toBe(false);
  });

  it("is false for a no-op change on a healthy roster", () => {
    expect(strandsWorkspace([OWNER_A, OWNER_B], { targetId: "a" })).toBe(false);
  });

  it("reports true for a roster that already has no active owner", () => {
    // Not reachable through this screen, but the predicate must not claim the
    // change is safe merely because it changed nothing.
    expect(strandsWorkspace([OWNER_INACTIVE, ADJUSTER], { targetId: "d" })).toBe(true);
  });
});

describe("activeOwnersAfter", () => {
  it("names who would be left holding the workspace", () => {
    expect(
      activeOwnersAfter([OWNER_A, OWNER_B, ADJUSTER], {
        targetId: "a",
        nextActive: false,
      }),
    ).toEqual(["b"]);
  });

  it("leaves rows other than the target untouched", () => {
    expect(
      activeOwnersAfter([OWNER_A, OWNER_B], { targetId: "zzz", nextActive: false }),
    ).toEqual(["a", "b"]);
  });
});

describe("isStaffAppRole", () => {
  it("accepts the three staff roles", () => {
    expect(isStaffAppRole("owner")).toBe(true);
    expect(isStaffAppRole("adjuster")).toBe(true);
    expect(isStaffAppRole("assistant")).toBe(true);
  });

  it("rejects the portal roles and anything that is not a role", () => {
    // The staff screen must not be able to turn a homeowner into an adjuster,
    // or move a partner rep off `partner` while their partner_company_id stays
    // set and quietly lists them as a company's representative.
    expect(isStaffAppRole("customer")).toBe(false);
    expect(isStaffAppRole("partner")).toBe(false);
    expect(isStaffAppRole("")).toBe(false);
    expect(isStaffAppRole("OWNER")).toBe(false);
    expect(isStaffAppRole(undefined)).toBe(false);
    expect(isStaffAppRole(null)).toBe(false);
  });
});
