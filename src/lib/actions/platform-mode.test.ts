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

describe.each(["simple", "", "invalid", undefined])("disabled platform (%s)", (mode) => {
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
  ] as const)("closes %s before any data or authentication call", async (_name, action) => {
    await expect(action()).rejects.toThrow("redirect:/platform-disabled");
    expect(stub.createClient).not.toHaveBeenCalled();
    expect(stub.createAdminClient).not.toHaveBeenCalled();
    expect(stub.headers).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
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
