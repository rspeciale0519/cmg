import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  OWNER_ID: "10000000-0000-4000-a000-000000000001",
  ADJUSTER_ID: "10000000-0000-4000-a000-000000000002",
  OTHER_ADJUSTER_ID: "10000000-0000-4000-a000-000000000003",
  session: {
    userId: "10000000-0000-4000-a000-000000000001",
    email: "owner@example.com",
    aal: "aal2",
    role: "owner",
  },
  claimant: {
    id: "20000000-0000-4000-a000-000000000001",
    first_name: "Dana",
    last_name: "Whitfield",
    email: "dana@example.com",
    claim_id: "30000000-0000-4000-a000-000000000001",
    user_id: null,
    claims: {
      claim_ref: "CMG-2026-0042",
      assigned_adjuster_id: "10000000-0000-4000-a000-000000000002",
    },
  },
  issueInvite: vi.fn(async () => ({
    ok: true as const,
    queued: false,
    url: "https://cmg.test/invite/token",
  })),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/authz", () => ({
  requireStaff: vi.fn(async () => stub.session),
  requireOpenPath: vi.fn(() => {}),
}));
vi.mock("@/lib/email/outbox", () => ({ resendApiKey: vi.fn(() => null) }));
vi.mock("@/lib/invites", () => ({
  issueInvite: stub.issueInvite,
  findRedeemableInvite: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {},
  checkRateLimit: vi.fn(),
  clientIpFromHeaders: vi.fn(() => "203.0.113.9"),
  inetOrNull: vi.fn((value: string) => value),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: stub.claimant, error: null }) }),
      }),
    }),
  })),
}));

import { issueClaimantInvite } from "./invite";
import { idleInviteIssueState } from "./types";

function form(): FormData {
  const data = new FormData();
  data.set("claimantId", stub.claimant.id);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  /* This file is about *who* may issue an invite, not about which mode is
     running — that boundary is pinned in `platform-mode.test.ts` and in
     `invite-issuance-mode.test.ts`. `issueClaimantInvite` reads the real
     `isSurfaceOpen("/invite")`, unmocked, so `platform` is stubbed here to
     keep every case in this file from depending on the ambient SITE_MODE. */
  vi.stubEnv("SITE_MODE", "platform");
  stub.session = {
    userId: stub.OWNER_ID,
    email: "owner@example.com",
    aal: "aal2",
    role: "owner",
  };
  stub.claimant.claims.assigned_adjuster_id = stub.ADJUSTER_ID;
  stub.issueInvite.mockResolvedValue({
    ok: true,
    queued: false,
    url: "https://cmg.test/invite/token",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("issueClaimantInvite authorization", () => {
  it("allows an owner regardless of claim assignment", async () => {
    const state = await issueClaimantInvite(idleInviteIssueState, form());

    expect(state.status).toBe("success");
    expect(stub.issueInvite).toHaveBeenCalledOnce();
  });

  it("allows the adjuster assigned to the claim", async () => {
    stub.session = {
      userId: stub.ADJUSTER_ID,
      email: "adjuster@example.com",
      aal: "aal2",
      role: "adjuster",
    };

    const state = await issueClaimantInvite(idleInviteIssueState, form());

    expect(state.status).toBe("success");
    expect(stub.issueInvite).toHaveBeenCalledOnce();
  });

  it("refuses an unassigned adjuster without disclosing the claimant", async () => {
    stub.session = {
      userId: stub.OTHER_ADJUSTER_ID,
      email: "other@example.com",
      aal: "aal2",
      role: "adjuster",
    };

    const state = await issueClaimantInvite(idleInviteIssueState, form());

    expect(state.status).toBe("error");
    expect(state.message).not.toMatch(/claimant|assigned|authori[sz]ed/i);
    expect(stub.issueInvite).not.toHaveBeenCalled();
  });
});
