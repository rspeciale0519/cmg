import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract these pin: **accepting a partner-portal referral cannot move the
 * claim off the referring company unless the operator explicitly says so.**
 *
 * `/partner/refer` writes `claims.partner_company_id` at submission, and that
 * column is what the referring firm's reps see the claim through.
 * `accept_intake_transaction` writes whatever attribution it is given: `none`
 * nulls the column and `new` mints a company and moves the claim to it. The
 * accept form used to default a portal referral to "Create" (named from
 * `referrer_name`), so the default accept made a duplicate company and the
 * referring firm lost the claim. A public intake, with no
 * `partner_company_id`, must behave exactly as before.
 *
 * The stubs stop at the module boundary, as in `intake-accept-policy.test.ts`.
 */

const stub = vi.hoisted(() => {
  const OWNER_ID = "00000000-0000-4000-a000-000000000001";
  const ADJUSTER_ID = "00000000-0000-4000-a000-000000000002";
  const CLAIM_ID = "24000000-0000-4000-a000-000000000001";
  const PORTAL_COMPANY_ID = "24000000-0000-4000-a000-0000000000c1";
  const OTHER_COMPANY_ID = "24000000-0000-4000-a000-0000000000c2";

  return {
    OWNER_ID,
    ADJUSTER_ID,
    CLAIM_ID,
    PORTAL_COMPANY_ID,
    OTHER_COMPANY_ID,
    session: { userId: OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" },
    claim: {
      id: CLAIM_ID,
      claim_ref: "CMG-2026-0004",
      status: "new_intake",
      assigned_adjuster_id: null as string | null,
      referrer_name: "Summit Exteriors LLC — Riley Tester" as string | null,
      referrer_email: "rep@summit.test" as string | null,
      carrier: null as string | null,
      partner_company_id: PORTAL_COMPANY_ID as string | null,
    },
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
vi.mock("./intake-invites", () => ({
  inviteIntakeClaimants: vi.fn(async () => ({ issued: 0, queued: 0, unqueued: 0, failed: 0 })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: async (name: string, args: unknown) => {
      stub.rpcCalled(name, args);
      return { error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: stub.claim, error: null }),
        }),
      }),
    }),
  })),
}));

import { acceptIntake } from "./intake-queue";
import { idleState } from "./types";

const POLICY = {
  carrier: "Citizens Property Insurance",
  policyNumber: "FL-88213-A",
  carrierTenure: "three_plus_years",
  lorContractType: "non_emergency",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  const all = { claimId: stub.CLAIM_ID, adjusterId: stub.ADJUSTER_ID, note: "", ...POLICY, ...fields };
  for (const [key, value] of Object.entries(all)) data.append(key, value);
  return data;
}

const acceptArgs = () =>
  stub.rpcCalled.mock.calls.find(([name]) => name === "accept_intake_transaction")?.[1] as
    | Record<string, unknown>
    | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  stub.claim.partner_company_id = stub.PORTAL_COMPANY_ID;
  stub.claim.referrer_name = "Summit Exteriors LLC — Riley Tester";
  stub.claim.carrier = null;
});

describe("acceptIntake — a partner-portal referral", () => {
  it("accepts with the referring company kept, and needs no confirmation", async () => {
    const state = await acceptIntake(
      idleState,
      form({ partnerChoice: "existing", partnerCompanyId: stub.PORTAL_COMPANY_ID }),
    );

    expect(state.status).toBe("success");
    expect(acceptArgs()).toMatchObject({
      p_partner_choice: "existing",
      p_partner_company_id: stub.PORTAL_COMPANY_ID,
      p_new_partner_name: null,
    });
  });

  it.each([
    ["Create (the old default)", { partnerChoice: "new", newPartnerName: "Summit Exteriors LLC — Riley Tester" }],
    ["None", { partnerChoice: "none" }],
    ["a different existing company", { partnerChoice: "existing", partnerCompanyId: "24000000-0000-4000-a000-0000000000c2" }],
    ["a submission with no partner choice at all", {}],
  ])("refuses %s without the explicit confirmation, and writes nothing", async (_label, fields) => {
    const state = await acceptIntake(idleState, form(fields));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.replacePortalReferral).toBeDefined();
    expect(stub.rpcCalled).not.toHaveBeenCalled();
  });

  it("keeps the operator's typing on that refusal", async () => {
    const state = await acceptIntake(
      idleState,
      form({ partnerChoice: "new", newPartnerName: "Summit Roofing", note: "Called Dana." }),
    );

    expect(state.values?.newPartnerName).toBe("Summit Roofing");
    expect(state.values?.note).toBe("Called Dana.");
  });

  it("replaces the attribution when the operator confirms it", async () => {
    const state = await acceptIntake(
      idleState,
      form({
        partnerChoice: "existing",
        partnerCompanyId: stub.OTHER_COMPANY_ID,
        replacePortalReferral: "yes",
      }),
    );

    expect(state.status).toBe("success");
    expect(acceptArgs()).toMatchObject({
      p_partner_choice: "existing",
      p_partner_company_id: stub.OTHER_COMPANY_ID,
    });
  });

  it("echoes the confirmation back on an unrelated refusal, so the box stays ticked", async () => {
    const state = await acceptIntake(
      idleState,
      form({ partnerChoice: "none", replacePortalReferral: "yes", adjusterId: "" }),
    );

    expect(state.fieldErrors?.adjusterId).toBeDefined();
    expect(state.values?.replacePortalReferral).toBe("yes");
  });
});

describe("acceptIntake — a public intake with no portal attribution", () => {
  beforeEach(() => {
    stub.claim.partner_company_id = null;
    stub.claim.carrier = "Citizens Property Insurance";
  });

  it("still creates a company from the typed referrer without any confirmation", async () => {
    const state = await acceptIntake(
      idleState,
      form({ partnerChoice: "new", newPartnerName: "Gulf Coast Roofing" }),
    );

    expect(state.status).toBe("success");
    expect(acceptArgs()).toMatchObject({
      p_partner_choice: "new",
      p_new_partner_name: "Gulf Coast Roofing",
    });
  });

  it("still accepts with no referring company", async () => {
    const state = await acceptIntake(idleState, form({ partnerChoice: "none" }));

    expect(state.status).toBe("success");
    expect(acceptArgs()).toMatchObject({ p_partner_choice: "none", p_partner_company_id: null });
  });
});
