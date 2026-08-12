import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract these pin: **a claim cannot say a letter of representation has
 * been sent until it names the carrier the letter is addressed to, and there is
 * a screen that can supply the name.**
 *
 * Both halves are load-bearing and neither is enough alone. Phase 6 made
 * `carrier` and `policy_number` nullable so a referring contractor could send
 * CMG a homeowner and a loss without inventing a policy, and closed the gap at
 * accept. Accept is not the only door out of `new_intake`: the status picker
 * moves a claim to `under_review` without the accept form opening at all, and
 * from there `lor_sent` is one legal move — so a Letter of Representation, which
 * is a legal instrument addressed to an insurance carrier, could be drafted with
 * `Claim.Carrier` blank.
 *
 * `advanceClaimStatus` is the gate and the disabled pill in `StatusAdvance` is
 * the courtesy, which is why the refusals below are asserted on the action
 * rather than on the component. `saveClaimPolicy` is the door: it takes the
 * three columns after accept, and it is equally where a mis-heard policy number
 * is corrected — a wrong one is worse than a missing one, because it does not
 * announce itself.
 *
 * The stubs stop at the module boundary. `requireStaff`, `claims_update_manage`
 * and `public.enforce_claim_status_transition()` are the real gates and are
 * covered in the pgTAP suite.
 */

const stub = vi.hoisted(() => {
  const OWNER_ID = "00000000-0000-4000-a000-000000000001";
  const CLAIM_ID = "24000000-0000-4000-a000-000000000001";

  return {
    OWNER_ID,
    CLAIM_ID,
    session: { userId: OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" },
    /** A partner referral under review: no policy side at all. Overridden per test. */
    claim: {
      id: CLAIM_ID,
      claim_ref: "CMG-2026-0007",
      status: "under_review",
      assigned_adjuster_id: OWNER_ID,
      carrier: null as string | null,
      policy_number: null as string | null,
      carrier_tenure: null as string | null,
    },
    allowed: ["lor_sent", "rejected"] as string[],
    updated: vi.fn(),
    audited: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/authz", () => ({ requireStaff: vi.fn(async () => stub.session) }));
vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn(async (_client: unknown, entry: unknown) => {
    stub.audited(entry);
  }),
}));
vi.mock("@/lib/claims/record-transition", () => ({
  recordTransition: vi.fn(async () => [] as string[]),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    /* `allowed_claim_transitions` — the same function the BEFORE UPDATE trigger
       consults, which is why the action asks it rather than a map. */
    rpc: async () => ({ data: stub.allowed, error: null }),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: stub.claim, error: null }),
          /** The documents read behind the lor_signed gate. */
          eq: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      }),
      update: (patch: unknown) => {
        stub.updated(table, patch);
        return {
          eq: () => ({
            select: async () => ({ data: [{ id: stub.CLAIM_ID }], error: null }),
          }),
        };
      },
    }),
  })),
}));

import { advanceClaimStatus, saveClaimPolicy } from "./claims";
import { idleState } from "./types";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const POLICY = {
  claimId: stub.CLAIM_ID,
  carrier: "Citizens Property Insurance",
  policyNumber: "FL-CPI-4410",
  carrierTenure: "three_plus_years",
};

const claimUpdate = () =>
  stub.updated.mock.calls.find(([table]) => table === "claims")?.[1] as
    | Record<string, unknown>
    | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  stub.allowed = ["lor_sent", "rejected"];
  stub.claim = {
    id: stub.CLAIM_ID,
    claim_ref: "CMG-2026-0007",
    status: "under_review",
    assigned_adjuster_id: stub.OWNER_ID,
    carrier: null,
    policy_number: null,
    carrier_tenure: null,
  };
});

describe("advanceClaimStatus — the move that sends the letter", () => {
  it("refuses lor_sent on a claim that names no carrier, and writes nothing", async () => {
    const state = await advanceClaimStatus(
      idleState,
      form({ claimId: stub.CLAIM_ID, to: "lor_sent", note: "" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("CMG-2026-0007");
    expect(state.message).toMatch(/Policy and carrier/);
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("refuses it with a carrier but no policy number", async () => {
    stub.claim.carrier = "Citizens Property Insurance";

    const state = await advanceClaimStatus(
      idleState,
      form({ claimId: stub.CLAIM_ID, to: "lor_sent", note: "" }),
    );

    expect(state.status).toBe("error");
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("keeps the note the adjuster had written for the homeowner", async () => {
    const state = await advanceClaimStatus(
      idleState,
      form({
        claimId: stub.CLAIM_ID,
        to: "lor_sent",
        note: "Spoke to Dana; letter goes out this afternoon.",
      }),
    );

    expect(state.values?.note).toBe("Spoke to Dana; letter goes out this afternoon.");
  });

  it("allows it once both are on the file", async () => {
    stub.claim.carrier = "Citizens Property Insurance";
    stub.claim.policy_number = "FL-CPI-4410";

    const state = await advanceClaimStatus(
      idleState,
      form({ claimId: stub.CLAIM_ID, to: "lor_sent", note: "" }),
    );

    expect(state.status).toBe("success");
    expect(claimUpdate()).toEqual({ status: "lor_sent" });
  });

  it("does not gate the moves that are not the letter", async () => {
    // Declining a referral CMG does not want is not a letter to anybody, and a
    // gate that stopped it would trap every incomplete claim in the pipeline.
    stub.allowed = ["lor_sent", "rejected"];

    const state = await advanceClaimStatus(
      idleState,
      form({ claimId: stub.CLAIM_ID, to: "rejected", note: "" }),
    );

    expect(state.status).toBe("success");
    expect(claimUpdate()).toEqual({ status: "rejected" });
  });
});

describe("saveClaimPolicy — refusals", () => {
  it("marks an empty carrier and hands back what was typed", async () => {
    const state = await saveClaimPolicy(
      idleState,
      form({ ...POLICY, carrier: "   " }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.carrier).toBe("Name the insurance company.");
    expect(state.message).toBe("Check the highlighted field and save again.");
    expect(state.values?.carrier).toBe("   ");
    expect(state.values?.policyNumber).toBe(POLICY.policyNumber);
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("counts the highlighted fields it is pointing at", async () => {
    const state = await saveClaimPolicy(
      idleState,
      form({ ...POLICY, carrier: "", policyNumber: "" }),
    );

    expect(state.fieldErrors?.carrier).toBeDefined();
    expect(state.fieldErrors?.policyNumber).toBe("Enter the policy number.");
    expect(state.message).toBe("Check the highlighted fields and save again.");
  });

  it("refuses a carrier longer than the column, rather than letting Postgres do it", async () => {
    const state = await saveClaimPolicy(
      idleState,
      form({ ...POLICY, carrier: "C".repeat(121) }),
    );

    expect(state.fieldErrors?.carrier).toBe("Carrier must be 120 characters or fewer.");
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("refuses a policy number longer than the column", async () => {
    const state = await saveClaimPolicy(
      idleState,
      form({ ...POLICY, policyNumber: "P".repeat(81) }),
    );

    expect(state.fieldErrors?.policyNumber).toBe(
      "Policy number must be 80 characters or fewer.",
    );
  });

  it("refuses a carrier tenure that is not one of the database's labels", async () => {
    const state = await saveClaimPolicy(
      idleState,
      form({ ...POLICY, carrierTenure: "about a decade" }),
    );

    expect(state.fieldErrors?.carrierTenure).toBe(
      "Say how long they have been with this carrier.",
    );
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("echoes even when the claim id never named a claim", async () => {
    const state = await saveClaimPolicy(
      idleState,
      form({ ...POLICY, claimId: "not-a-uuid" }),
    );

    expect(state.status).toBe("error");
    expect(state.values).toEqual({
      carrier: POLICY.carrier,
      policyNumber: POLICY.policyNumber,
      carrierTenure: POLICY.carrierTenure,
    });
    expect(stub.updated).not.toHaveBeenCalled();
  });
});

describe("saveClaimPolicy — the write", () => {
  it("stores the three columns, trimmed", async () => {
    const state = await saveClaimPolicy(
      idleState,
      form({ ...POLICY, carrier: "  Citizens Property Insurance  " }),
    );

    expect(state.status).toBe("success");
    expect(claimUpdate()).toEqual({
      carrier: "Citizens Property Insurance",
      policy_number: "FL-CPI-4410",
      carrier_tenure: "three_plus_years",
    });
  });

  it("says the block is lifted when the claim was sitting behind it", async () => {
    const state = await saveClaimPolicy(idleState, form(POLICY));

    expect(state.status).toBe("success");
    expect(state.message).toMatch(/no longer held back/);
  });

  it("does not promise that on a claim with no block to lift yet", async () => {
    // A new intake is not at the gate, so a sentence about lifting one would be
    // describing a screen the operator has not seen.
    stub.claim.status = "new_intake";

    const state = await saveClaimPolicy(idleState, form(POLICY));

    expect(state.message).toBe("Policy details recorded for CMG-2026-0007.");
  });

  it("records that this was the first entry, which is what unblocks the letter", async () => {
    await saveClaimPolicy(idleState, form(POLICY));

    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "claim.policy_updated",
        entity: "claims",
        entityId: stub.CLAIM_ID,
        meta: expect.objectContaining({ claim_ref: "CMG-2026-0007", first_entry: true }),
      }),
    );
  });

  it("records a correction as a correction", async () => {
    stub.claim.carrier = "Citizns Property Insurance";
    stub.claim.policy_number = "FL-CPI-4410";

    const state = await saveClaimPolicy(idleState, form(POLICY));

    expect(state.message).toBe("Policy details updated for CMG-2026-0007.");
    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ first_entry: false }),
      }),
    );
  });
});
