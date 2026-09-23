import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract these pin: **a control that lives on `/admin` never redirects
 * a staff member off it.**
 *
 * `issueClaimantInvite`, `invitePartnerRep` and `inviteStaff` each mint a
 * `/invite/:token` link, and that surface is closed in `staff` mode. Before
 * this, `issueClaimantInvite` called `requireOpenPath("/invite")` — which
 * redirects to `/platform-disabled` — from inside a server action reached by
 * a button on the admin dashboard and on a claim's Claimants tab: a stale
 * form bounced a signed-in staff member out of the desk they were looking at.
 * `invitePartnerRep` and `inviteStaff` had no guard at all, so they minted a
 * token — and, for `inviteStaff`, queued an `invite` email
 * `deliverableTemplates()` will never put on the wire — for a link that could
 * never be opened.
 *
 * All three now check `isSurfaceOpen("/invite")` themselves and answer with an
 * ordinary `FormState` refusal instead, so `ActionFeedback` shows the same
 * sentence a `<form action={…}>` on that page always renders. `platform` mode
 * is the control for each: same inputs, only `SITE_MODE` different, and
 * issuance must be unaffected.
 *
 * The stubs stop at the module boundary, same as `invite-authorization.test.ts`:
 * `requireStaff`, `requireOwner` and the RLS/trigger stack are the real gates
 * and have their own coverage elsewhere.
 */

const stub = vi.hoisted(() => {
  const OWNER_ID = "60000000-0000-4000-a000-000000000001";

  return {
    OWNER_ID,
    session: { userId: OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" },
    claimant: {
      id: "60000000-0000-4000-a000-000000000002",
      first_name: "Dana",
      last_name: "Whitfield",
      email: "dana@example.com",
      claim_id: "60000000-0000-4000-a000-000000000003",
      user_id: null as string | null,
      claims: { claim_ref: "CMG-2026-0060", assigned_adjuster_id: null as string | null },
    },
    company: {
      id: "60000000-0000-4000-a000-000000000004",
      name: "Summit Exteriors LLC",
      status: "active" as const,
    },
    issueInvite: vi.fn(async () => ({
      ok: true as const,
      queued: false,
      url: "https://cmg.test/invite/token",
    })),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn(async () => {}) }));
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
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/authz", () => ({
  requireStaff: vi.fn(async () => stub.session),
  requireOwner: vi.fn(async () => stub.session),
  requireOpenPath: vi.fn(() => {}),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "partner_companies"
              ? { data: stub.company, error: null }
              : { data: stub.claimant, error: null },
        }),
      }),
    }),
  })),
}));

import { issueClaimantInvite } from "./invite";
import { invitePartnerRep } from "./partners";
import { inviteStaff } from "./staff";
import { idleInviteIssueState, INVITE_SURFACE_PAUSED } from "./types";

function claimantForm(): FormData {
  const data = new FormData();
  data.set("claimantId", stub.claimant.id);
  return data;
}

function partnerForm(): FormData {
  const data = new FormData();
  data.set("companyId", stub.company.id);
  data.set("email", "rep@contractor.com");
  data.set("firstName", "Alex");
  return data;
}

function staffForm(): FormData {
  const data = new FormData();
  data.set("email", "sam@cmgpropertysolutions.net");
  data.set("firstName", "Sam");
  data.set("role", "adjuster");
  return data;
}

const CASES = [
  ["issueClaimantInvite", () => issueClaimantInvite(idleInviteIssueState, claimantForm())],
  ["invitePartnerRep", () => invitePartnerRep(idleInviteIssueState, partnerForm())],
  ["inviteStaff", () => inviteStaff(idleInviteIssueState, staffForm())],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  stub.issueInvite.mockResolvedValue({
    ok: true,
    queued: false,
    url: "https://cmg.test/invite/token",
  });
  stub.claimant.user_id = null;
  stub.claimant.claims.assigned_adjuster_id = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(CASES)("%s and the /invite surface", (_name, run) => {
  it("returns a generic refusal state, not a redirect, in staff mode", async () => {
    vi.stubEnv("SITE_MODE", "staff");

    const state = await run();

    expect(state.status).toBe("error");
    expect(state.message).toBe(INVITE_SURFACE_PAUSED);
    expect(stub.issueInvite).not.toHaveBeenCalled();
  });

  it("still issues the invitation in platform mode", async () => {
    vi.stubEnv("SITE_MODE", "platform");

    const state = await run();

    expect(state.status).toBe("success");
    expect(stub.issueInvite).toHaveBeenCalledOnce();
  });
});
