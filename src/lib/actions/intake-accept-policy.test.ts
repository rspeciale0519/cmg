import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract these pin: **an intake that arrived without a policy side cannot
 * leave the queue still missing it.**
 *
 * A partner referral is created by `referClaim` with `carrier`, `policy_number`
 * and `carrier_tenure` null — spec §6 does not ask a contractor for them, and
 * the 20260812120000 migration made the columns nullable so the row could state
 * the absence instead of inventing values. §6 also names the moment they are
 * collected: "staff completes details on accept". So acceptance is where the gap
 * closes, and these are the properties that make that true rather than optional:
 *
 *   * the requirement is derived from the *claim row*, not from whether the form
 *     sent the fields — a client that omits an input must be refused, not obeyed;
 *   * the three columns move in the same UPDATE as the status, so no claim can
 *     be accepted-but-incomplete even for one statement;
 *   * a submission from /file-a-claim, which already carries all three, is not
 *     asked again — re-asking would invite an operator to overwrite what the
 *     homeowner typed with what they remember of a phone call.
 *
 * The stubs stop at the module boundary. `requireStaff`, `claims_update_manage`
 * and `public.guard_claim_update()` are the real gates and are covered in the
 * pgTAP suite.
 */

const stub = vi.hoisted(() => {
  const OWNER_ID = "00000000-0000-4000-a000-000000000001";
  const ADJUSTER_ID = "00000000-0000-4000-a000-000000000002";
  const CLAIM_ID = "23000000-0000-4000-a000-000000000001";

  return {
    OWNER_ID,
    ADJUSTER_ID,
    CLAIM_ID,
    session: { userId: OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" },
    /** Null carrier = a partner referral. Overridden per test. */
    claim: {
      id: CLAIM_ID,
      claim_ref: "CMG-2026-0003",
      status: "new_intake",
      assigned_adjuster_id: null as string | null,
      referrer_name: "Summit Exteriors LLC — Tyler Boone",
      referrer_email: "partner@cmg.test",
      carrier: null as string | null,
    },
    updated: vi.fn(),
    rpcCalled: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/authz", () => ({ requireStaff: vi.fn(async () => stub.session) }));
vi.mock("@/lib/invites", () => ({
  issueInvite: vi.fn(async () => ({ ok: true, url: "https://example.test/invite/x" })),
}));
vi.mock("@/lib/claims/record-transition", () => ({
  recordTransition: vi.fn(async () => [] as string[]),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: async (name: string, args: unknown) => {
      stub.rpcCalled(name, args);
      return { error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: stub.claim, error: null }),
          /** The claimants read the invite step makes. */
          is: async () => ({ data: [], error: null }),
        }),
      }),
      update: (patch: unknown) => {
        stub.updated(table, patch);
        return {
          eq: () => ({
            eq: () => ({ select: async () => ({ data: [{ id: stub.CLAIM_ID }], error: null }) }),
          }),
        };
      },
    }),
  })),
}));

import { acceptIntake } from "./intake-queue";
import { idleState } from "./types";

const BASE = {
  claimId: stub.CLAIM_ID,
  adjusterId: stub.ADJUSTER_ID,
  partnerChoice: "none",
  note: "",
};

const POLICY = {
  carrier: "Citizens Property Insurance",
  policyNumber: "FL-88213-A",
  carrierTenure: "three_plus_years",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...BASE, ...fields })) {
    data.append(key, value);
  }
  return data;
}

const claimUpdate = () =>
  stub.updated.mock.calls.find(([table]) => table === "claims")?.[1] as
    | Record<string, unknown>
    | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  stub.claim = {
    id: stub.CLAIM_ID,
    claim_ref: "CMG-2026-0003",
    status: "new_intake",
    assigned_adjuster_id: null,
    referrer_name: "Summit Exteriors LLC — Tyler Boone",
    referrer_email: "partner@cmg.test",
    carrier: null,
  };
});

describe("acceptIntake — a partner referral", () => {
  it("refuses to accept it with no policy details, and writes nothing", async () => {
    const state = await acceptIntake(idleState, form({}));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.carrier).toBe("Name the insurance company.");
    expect(state.fieldErrors?.policyNumber).toBe("Enter the policy number.");
    expect(state.fieldErrors?.carrierTenure).toBeDefined();
    expect(stub.updated).not.toHaveBeenCalled();
    expect(stub.rpcCalled).not.toHaveBeenCalled();
  });

  it("keeps the operator's other typing on that refusal", async () => {
    const state = await acceptIntake(
      idleState,
      form({ note: "Spoke to Dana, sending the letter today.", carrier: "Citizens" }),
    );

    expect(state.values?.note).toBe("Spoke to Dana, sending the letter today.");
    expect(state.values?.carrier).toBe("Citizens");
  });

  it("marks only the field that is missing", async () => {
    const state = await acceptIntake(
      idleState,
      form({ ...POLICY, policyNumber: "  " }),
    );

    expect(state.fieldErrors?.policyNumber).toBeDefined();
    expect(state.fieldErrors?.carrier).toBeUndefined();
    expect(state.message).toBe("Check the highlighted field and accept again.");
  });

  it("refuses a carrier tenure that is not one of the database's labels", async () => {
    const state = await acceptIntake(
      idleState,
      form({ ...POLICY, carrierTenure: "about a decade" }),
    );

    expect(state.fieldErrors?.carrierTenure).toBeDefined();
    expect(stub.updated).not.toHaveBeenCalled();
  });

  /**
   * The atomicity that matters: attribution, policy and status in one statement,
   * for the reason `acceptIntake`'s own comment gives — one statement is one
   * transaction, so the claim never exists accepted-but-incomplete.
   */
  it("writes the policy in the same statement as the status change", async () => {
    const state = await acceptIntake(idleState, form(POLICY));

    expect(state.status).toBe("success");
    expect(claimUpdate()).toEqual({
      status: "under_review",
      carrier: "Citizens Property Insurance",
      policy_number: "FL-88213-A",
      carrier_tenure: "three_plus_years",
    });
  });

  it("stores the trimmed values", async () => {
    await acceptIntake(
      idleState,
      form({ ...POLICY, carrier: "  Citizens Property Insurance  " }),
    );

    expect(claimUpdate()?.carrier).toBe("Citizens Property Insurance");
  });
});

describe("acceptIntake — a submission from the public form", () => {
  beforeEach(() => {
    stub.claim.carrier = "Citizens Property Insurance";
  });

  it("is not asked for the policy again, because the homeowner already gave it", async () => {
    const state = await acceptIntake(idleState, form({}));

    expect(state.status).toBe("success");
    expect(claimUpdate()).toEqual({ status: "under_review" });
  });

  /**
   * The reason the requirement is read from the claim row rather than from the
   * submission: a client that sends the fields anyway must not be able to
   * rewrite what the homeowner typed.
   */
  it("ignores policy fields sent for a claim that already has them", async () => {
    await acceptIntake(
      idleState,
      form({ carrier: "Somebody Else Insurance", policyNumber: "XX-1", carrierTenure: "lt_1_year" }),
    );

    expect(claimUpdate()).toEqual({ status: "under_review" });
  });
});
