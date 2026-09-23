import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract these pin: **acceptance follows the `/invite` surface, not the
 * ambient assumption that it is always open.**
 *
 * Before this, `acceptIntake` called `inviteIntakeClaimants` unconditionally,
 * which reaches `issueInvite` directly — bypassing the guard
 * `issueClaimantInvite` applies. In `staff` mode that minted a single-use,
 * one-way-hashed token for a `/invite/:token` link that redirects to
 * `/platform-disabled`, and queued an `invite` email `deliverableTemplates()`
 * will never put on the wire — an outbox row `pending` forever — while the
 * success banner still claimed "N portal invitations issued; N queued for
 * email."
 *
 * `platform` mode is the control: the same acceptance, same claim, same
 * mocked claimant, with only `SITE_MODE` different, and it must come out
 * exactly as it did before this fix.
 *
 * The stubs stop at the module boundary, same as `intake-accept-policy.test.ts`:
 * `requireStaff`, `claims_update_manage` and the RLS/trigger stack are the real
 * gates and are covered in the pgTAP suite.
 */

const stub = vi.hoisted(() => {
  const OWNER_ID = "50000000-0000-4000-a000-000000000001";
  const ADJUSTER_ID = "50000000-0000-4000-a000-000000000002";
  const CLAIM_ID = "50000000-0000-4000-a000-000000000003";

  return {
    OWNER_ID,
    ADJUSTER_ID,
    CLAIM_ID,
    session: { userId: OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" },
    /* Carrier already on file — a public-form submission — so the policy
       fields are not asked for again and every case here reaches the invite
       step without first having to satisfy `intake-accept-policy.test.ts`'s
       contract. */
    claim: {
      id: CLAIM_ID,
      claim_ref: "CMG-2026-0050",
      status: "new_intake",
      assigned_adjuster_id: null as string | null,
      referrer_name: null as string | null,
      referrer_email: null as string | null,
      carrier: "Citizens Property Insurance",
    },
    inviteIntakeClaimants: vi.fn(async () => ({
      issued: 2,
      queued: 2,
      unqueued: 0,
      failed: 0,
    })),
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
  inviteIntakeClaimants: stub.inviteIntakeClaimants,
}));
vi.mock("@/lib/claims/record-transition", () => ({
  recordTransition: vi.fn(async () => [] as string[]),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: async () => ({ error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: stub.claim, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({ select: async () => ({ data: [{ id: stub.CLAIM_ID }], error: null }) }),
        }),
      }),
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

function form(fields: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...BASE, ...fields })) {
    data.append(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.claim = {
    id: stub.CLAIM_ID,
    claim_ref: "CMG-2026-0050",
    status: "new_intake",
    assigned_adjuster_id: null,
    referrer_name: null,
    referrer_email: null,
    carrier: "Citizens Property Insurance",
  };
  stub.inviteIntakeClaimants.mockResolvedValue({
    issued: 2,
    queued: 2,
    unqueued: 0,
    failed: 0,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("acceptIntake — platform mode", () => {
  beforeEach(() => vi.stubEnv("SITE_MODE", "platform"));

  it("issues invitations exactly as it always has", async () => {
    const state = await acceptIntake(idleState, form());

    expect(state.status).toBe("success");
    expect(stub.inviteIntakeClaimants).toHaveBeenCalledOnce();
    expect(stub.inviteIntakeClaimants).toHaveBeenCalledWith(
      stub.CLAIM_ID,
      "CMG-2026-0050",
      stub.OWNER_ID,
      null,
    );
    expect(state.message).toBe(
      "CMG-2026-0050 accepted and under review. 2 portal invitations issued; 2 queued for email.",
    );
  });
});

describe("acceptIntake — staff mode", () => {
  beforeEach(() => vi.stubEnv("SITE_MODE", "staff"));

  it("issues no invitations at all", async () => {
    const state = await acceptIntake(idleState, form());

    expect(state.status).toBe("success");
    expect(stub.inviteIntakeClaimants).not.toHaveBeenCalled();
  });

  it("reports acceptance honestly instead of claiming invitations were sent", async () => {
    const state = await acceptIntake(idleState, form());

    expect(state.message).toBe(
      "CMG-2026-0050 accepted and under review. Portal invitations will be sent when the customer portal opens.",
    );
    expect(state.message).not.toMatch(/invitation.*issued/i);
  });
});
