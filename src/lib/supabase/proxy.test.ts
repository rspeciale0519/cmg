// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The contract this pins: **`updateSession` is the one place the whole app is
 * gated, and it must gate the right thing for the right reason.**
 *
 *   * Simple mode closes every platform prefix before a Supabase client is even
 *     constructed — there is no session to check, so constructing one would be
 *     a client that can never do anything, created on every request to a build
 *     that has no login at all.
 *   * Platform mode's three outcomes — send to `/login`, send to the caller's
 *     own surface, send to `/mfa` — are the whole of spec §7.2 and §7.9, and the
 *     proxy is the layer that runs before any page does.
 *   * `Set-Cookie` written by a rotated refresh token has to survive onto the
 *     redirect response, not just the response that gets discarded — see the
 *     comment on `redirectPreservingSession`, and the bug it exists to prevent.
 *
 * `@supabase/ssr`'s `createServerClient` is mocked outright: this file's job is
 * the routing decision built on top of `auth.getClaims()` and a profile role
 * read, not the Supabase client itself.
 */

const getClaims = vi.fn();
const maybeSingle = vi.fn();
const createServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

const { updateSession } = await import("./proxy");

type Claims = { sub: string; email?: string; aal: string } | null;

/**
 * Builds the fake client `createServerClient` returns, and — critically — calls
 * the caller's own `cookies.setAll` during `getClaims()`, exactly as the real
 * client does when a refresh token rotates mid-request. That is the only way
 * `redirectPreservingSession` has anything to preserve.
 */
function mockClient(claims: Claims, role: string | null, rotatedCookie?: { name: string; value: string }) {
  createServerClient.mockImplementation(
    (_url: string, _key: string, options: { cookies: { setAll: (cookies: Array<{ name: string; value: string; options?: unknown }>) => void } }) => {
      if (rotatedCookie) {
        options.cookies.setAll([{ name: rotatedCookie.name, value: rotatedCookie.value, options: {} }]);
      }
      return {
        auth: { getClaims },
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle }),
          }),
        }),
      };
    },
  );
  getClaims.mockResolvedValue({ data: { claims } });
  maybeSingle.mockResolvedValue({ data: role ? { role } : null });
}

function request(pathname: string, search = ""): NextRequest {
  return new NextRequest(new Request(`https://cmg.test${pathname}${search}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.SITE_MODE;
});

describe("simple mode — every platform prefix closes before any client exists", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "simple";
  });

  it.each(["/login", "/mfa", "/invite", "/admin", "/portal", "/partner"])(
    "redirects %s to /platform-disabled without constructing a Supabase client",
    async (prefix) => {
      const response = await updateSession(request(`${prefix}/sub/path`));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://cmg.test/platform-disabled");
      expect(createServerClient).not.toHaveBeenCalled();
    },
  );

  it("does not touch a marketing path", async () => {
    mockClient(null, null);

    const response = await updateSession(request("/about"));

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("platform mode — ungated API paths pass through regardless of session", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "platform";
    mockClient(null, null);
  });

  it.each(["/api/cron/outbox", "/api/pandadoc/webhook"])(
    "does not gate %s even signed out",
    async (path) => {
      const response = await updateSession(request(path));

      expect(response.headers.get("location")).toBeNull();
      expect(createServerClient).toHaveBeenCalledOnce();
    },
  );
});

describe("platform mode — signed out", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "platform";
  });

  it("sends /admin to /login with a next parameter", async () => {
    mockClient(null, null);

    const response = await updateSession(request("/admin/claims"));

    expect(response.headers.get("location")).toBe(
      "https://cmg.test/login?next=%2Fadmin%2Fclaims",
    );
  });

  it("sends /mfa to /login as well — it is authenticated-only, not public", async () => {
    mockClient(null, null);

    const response = await updateSession(request("/mfa"));

    expect(response.headers.get("location")).toBe("https://cmg.test/login?next=%2Fmfa");
  });
});

describe("platform mode — signed in, wrong surface", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "platform";
  });

  it("sends a customer at /admin to their own surface, /portal", async () => {
    mockClient({ sub: "user-1", aal: "aal2" }, "customer");

    const response = await updateSession(request("/admin/claims"));

    expect(response.headers.get("location")).toBe("https://cmg.test/portal");
  });
});

describe("platform mode — staff short a factor", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "platform";
  });

  it("sends an aal1 staff session at /admin to /mfa with a next parameter", async () => {
    mockClient({ sub: "user-1", aal: "aal1" }, "adjuster");

    const response = await updateSession(request("/admin/claims"));

    expect(response.headers.get("location")).toBe(
      "https://cmg.test/mfa?next=%2Fadmin%2Fclaims",
    );
  });

  it("lets an aal2 staff session through to /admin", async () => {
    mockClient({ sub: "user-1", aal: "aal2" }, "adjuster");

    const response = await updateSession(request("/admin/claims"));

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("Set-Cookie survives a redirect", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "platform";
  });

  it("carries a rotated session cookie onto the /login redirect", async () => {
    mockClient(null, null, { name: "sb-access-token", value: "rotated-value" });

    const response = await updateSession(request("/admin"));

    expect(response.headers.get("location")).toBe("https://cmg.test/login?next=%2Fadmin");
    const setCookie = response.cookies.get("sb-access-token");
    expect(setCookie?.value).toBe("rotated-value");
  });

  it("carries a rotated session cookie onto the /mfa redirect", async () => {
    mockClient({ sub: "user-1", aal: "aal1" }, "owner", {
      name: "sb-access-token",
      value: "rotated-again",
    });

    const response = await updateSession(request("/admin"));

    expect(response.headers.get("location")).toBe("https://cmg.test/mfa?next=%2Fadmin");
    expect(response.cookies.get("sb-access-token")?.value).toBe("rotated-again");
  });

  it("carries a rotated session cookie onto the wrong-surface redirect", async () => {
    mockClient({ sub: "user-1", aal: "aal2" }, "customer", {
      name: "sb-access-token",
      value: "rotated-customer",
    });

    const response = await updateSession(request("/admin"));

    expect(response.headers.get("location")).toBe("https://cmg.test/portal");
    expect(response.cookies.get("sb-access-token")?.value).toBe("rotated-customer");
  });
});
