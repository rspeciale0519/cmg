import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  createUser: vi.fn(),
  from: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireOpenPath: vi.fn(), requireStaff: vi.fn() }));
vi.mock("@/lib/email/outbox", () => ({ resendApiKey: vi.fn(), dispatchOutbox: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    auth: { admin: { createUser: mocks.createUser } },
  }),
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.rateLimit,
  clientIpFromHeaders: () => "127.0.0.1",
  inetOrNull: vi.fn(),
  RATE_LIMITS: { inviteAcceptIp: {}, inviteAcceptToken: {} },
}));

const { acceptInvite } = await import("./invite");
const token = "A".repeat(43);
const baseInvite = {
  id: "invite-id",
  email: "test@example.test",
  role: "customer",
  claim_id: null,
  partner_company_id: null,
  expires_at: "2100-01-01T00:00:00Z",
  accepted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue(true);
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
  });
});

describe("acceptInvite unusable invitations", () => {
  it("refuses expired and already-used tokens identically without reserving or creating an account", async () => {
    const results = [];
    for (const invite of [
      { ...baseInvite, expires_at: "2000-01-01T00:00:00Z" },
      { ...baseInvite, accepted_at: "2026-01-01T00:00:00Z" },
    ]) {
      mocks.maybeSingle.mockResolvedValueOnce({ data: invite, error: null });
      const form = new FormData();
      form.set("token", token);
      results.push(await acceptInvite({ status: "idle" }, form));
    }

    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toMatchObject({ status: "error", message: expect.stringContaining("no longer usable") });
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.from).toHaveBeenCalledWith("invites");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
});
