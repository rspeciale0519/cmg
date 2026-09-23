import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  role: "owner",
  aal: "aal2",
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  headers: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: stub.headers }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  notFound: () => { throw new Error("not-found"); },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: stub.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: stub.createAdminClient }));

const authz = await import("@/lib/authz");
const { signIn, signOut } = await import("./auth");
const { acceptInvite } = await import("./invite");
const { beginTotpEnrollment, verifyTotp } = await import("./mfa");
const { requestPasswordReset, resetPassword } = await import("./password-reset");

beforeEach(() => {
  vi.clearAllMocks();
  stub.role = "owner";
  stub.aal = "aal2";
  stub.getClaims.mockImplementation(async () => ({
    data: { claims: { sub: "test-user", email: "test@example.test", aal: stub.aal } },
  }));
  stub.createClient.mockResolvedValue({
    auth: { getClaims: stub.getClaims },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { role: stub.role } }) }),
      }),
    }),
  });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("unexpected network call"); }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each(["simple", "", "invalid", "staffing", "platforms", undefined])(
  "nothing private open (SITE_MODE=%j)",
  (mode) => {
  beforeEach(() => vi.stubEnv("SITE_MODE", mode));

  it("does not read the session or role", async () => {
    expect(await authz.getSession()).toBeNull();
    expect(await authz.hasRole("owner")).toBe(false);
    expect(stub.createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["user", () => authz.requireUser()],
    ["staff", () => authz.requireStaff()],
    ["owner", () => authz.requireOwner()],
    ["customer", () => authz.requireRole("customer")],
    ["claim", () => authz.requireClaimAccess("20000000-0000-4000-a000-000000000001")],
    ["sign in", () => signIn({ status: "idle" }, new FormData())],
    ["sign out", () => signOut()],
    ["invitation", () => acceptInvite({ status: "idle" }, new FormData())],
    ["MFA enrollment", () => beginTotpEnrollment()],
    ["MFA verification", () => verifyTotp({ status: "idle" }, new FormData())],
    ["password reset request", () => requestPasswordReset({ status: "idle" }, new FormData())],
    ["password reset", () => resetPassword({ status: "idle" }, new FormData())],
  ] as const)("closes %s before any data or authentication call", async (_name, action) => {
    await expect(action()).rejects.toThrow("redirect:/platform-disabled");
    expect(stub.createClient).not.toHaveBeenCalled();
    expect(stub.createAdminClient).not.toHaveBeenCalled();
    expect(stub.headers).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

/**
 * Staff mode: the claims desk works, and every surface it does not open refuses
 * in the app layer as well as in the proxy.
 *
 * The two halves matter separately. A staff helper that still 404'd or redirected
 * here would make staff mode useless; a customer or partner helper that stopped
 * refusing here would rest the whole boundary on `proxy.ts`, one route-matcher
 * edit away from not existing.
 */
describe("staff mode", () => {
  beforeEach(() => vi.stubEnv("SITE_MODE", "staff"));

  it("reads the session and role, unlike a mode with nothing private open", async () => {
    await expect(authz.getSession()).resolves.toMatchObject({
      role: "owner",
      aal: "aal2",
    });
    expect(stub.createClient).toHaveBeenCalled();
  });

  it("lets an aal2 owner through requireOwner", async () => {
    await expect(authz.requireOwner()).resolves.toMatchObject({
      role: "owner",
      aal: "aal2",
    });
    expect(stub.createAdminClient).not.toHaveBeenCalled();
  });

  it("lets an aal2 adjuster through requireStaff", async () => {
    stub.role = "adjuster";
    await expect(authz.requireStaff()).resolves.toMatchObject({ role: "adjuster" });
  });

  it("still requires the staff second factor", async () => {
    stub.aal = "aal1";
    await expect(authz.requireStaff()).rejects.toThrow("redirect:/mfa");
  });

  it("still 404s a non-staff role reaching for a staff surface", async () => {
    stub.role = "assistant";
    await expect(authz.requireOwner()).rejects.toThrow("not-found");
  });

  it("keeps sign-in reachable, with its validation intact", async () => {
    await expect(
      signIn({ status: "idle" }, new FormData()),
    ).resolves.toMatchObject({ status: "error" });
  });

  /* Asserted as "not closed by the mode gate" rather than "succeeds": both of
     these go on to talk to Supabase MFA, which the stub does not model. What
     matters here is only that they got past the boundary. */
  it.each([
    ["MFA enrollment", () => beginTotpEnrollment()],
    ["MFA verification", () => verifyTotp({ status: "idle" }, new FormData())],
  ] as const)("keeps %s past the mode gate — /mfa is open", async (_name, action) => {
    const outcome = await Promise.resolve(action()).then(
      () => null,
      (cause: unknown) => (cause instanceof Error ? cause.message : String(cause)),
    );
    expect(outcome).not.toBe("redirect:/platform-disabled");
  });

  it.each([
    ["password reset request", () => requestPasswordReset({ status: "idle" }, new FormData())],
    ["password reset", () => resetPassword({ status: "idle" }, new FormData())],
  ] as const)("keeps %s past the mode gate — recovery opens with /login", async (_name, action) => {
    const outcome = await Promise.resolve(action()).then(
      () => null,
      (cause: unknown) => (cause instanceof Error ? cause.message : String(cause)),
    );
    expect(outcome).not.toBe("redirect:/platform-disabled");
  });

  it("closes invitation acceptance — /invite is not open in staff mode", async () => {
    await expect(
      acceptInvite({ status: "idle" }, new FormData()),
    ).rejects.toThrow("redirect:/platform-disabled");
    expect(stub.createAdminClient).not.toHaveBeenCalled();
  });

  it.each(["customer", "partner"] as const)(
    "refuses a %s with valid credentials, because their surface is closed",
    async (role) => {
      stub.role = role;
      await expect(authz.requireUser()).rejects.toThrow(
        "redirect:/platform-disabled",
      );
    },
  );

  it.each(["customer", "partner"] as const)(
    "refuses a %s at requireRole too, so a portal page cannot render",
    async (role) => {
      stub.role = role;
      await expect(authz.requireRole(role)).rejects.toThrow(
        "redirect:/platform-disabled",
      );
    },
  );

  it("refuses a customer reaching for a claim, before any claim read", async () => {
    stub.role = "customer";
    await expect(
      authz.requireClaimAccess("20000000-0000-4000-a000-000000000001"),
    ).rejects.toThrow("redirect:/platform-disabled");
  });
});

describe("enabled platform", () => {
  beforeEach(() => vi.stubEnv("SITE_MODE", "platform"));

  it("keeps the user-scoped session and owner checks", async () => {
    await expect(authz.requireOwner()).resolves.toMatchObject({ role: "owner", aal: "aal2" });
    expect(stub.createClient).toHaveBeenCalledOnce();
    expect(stub.createAdminClient).not.toHaveBeenCalled();
  });

  it("still requires the staff second factor", async () => {
    stub.aal = "aal1";
    await expect(authz.requireStaff()).rejects.toThrow("redirect:/mfa");
  });

  it("still uses the same not-found response for a refused role", async () => {
    stub.role = "customer";
    await expect(authz.requireStaff()).rejects.toThrow("not-found");
  });

  it("keeps normal sign-in validation", async () => {
    await expect(signIn({ status: "idle" }, new FormData())).resolves.toMatchObject({ status: "error" });
    expect(stub.createClient).not.toHaveBeenCalled();
  });
});
