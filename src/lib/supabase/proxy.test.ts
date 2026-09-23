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

/**
 * The mode gate as a matrix: six prefixes by three modes, every cell asserted.
 *
 * `openIn` is the same table `site-mode.ts` holds, restated here rather than
 * imported, so a change to that table has to be made deliberately in two places
 * and cannot be rubber-stamped by a test that reads its own answer.
 */
const PREFIX_MATRIX = [
  { prefix: "/login", openIn: ["platform", "staff"] },
  { prefix: "/forgot-password", openIn: ["platform", "staff"] },
  { prefix: "/auth/confirm", openIn: ["platform", "staff"] },
  { prefix: "/reset-password", openIn: ["platform", "staff"] },
  { prefix: "/mfa", openIn: ["platform", "staff"] },
  { prefix: "/admin", openIn: ["platform", "staff"] },
  { prefix: "/invite", openIn: ["platform"] },
  { prefix: "/portal", openIn: ["platform"] },
  { prefix: "/partner", openIn: ["platform"] },
] as const;

describe.each([
  ["simple", []],
  ["staff", ["/login", "/forgot-password", "/auth/confirm", "/reset-password", "/mfa", "/admin"]],
  [
    "platform",
    [
      "/login",
      "/forgot-password",
      "/auth/confirm",
      "/reset-password",
      "/mfa",
      "/admin",
      "/invite",
      "/portal",
      "/partner",
    ],
  ],
  // Fail-closed: anything unrecognised must behave exactly like simple.
  ["not-a-mode", []],
  ["", []],
] as const)("mode gate — SITE_MODE=%j", (mode, openPrefixes) => {
  beforeEach(() => {
    process.env.SITE_MODE = mode;
  });

  for (const { prefix } of PREFIX_MATRIX) {
    const open = (openPrefixes as readonly string[]).includes(prefix);

    if (open) {
      it(`lets ${prefix} past the mode gate and on to the session check`, async () => {
        mockClient(null, null);

        await updateSession(request(`${prefix}/sub/path`));

        /* The gate did not answer this request: the Supabase client exists,
           which is the observable difference between "closed by mode" and
           "open, and then decided on by session and role". */
        expect(createServerClient).toHaveBeenCalledOnce();
      });
    } else {
      it(`redirects ${prefix} to /platform-disabled without constructing a Supabase client`, async () => {
        const response = await updateSession(request(`${prefix}/sub/path`));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
          "https://cmg.test/platform-disabled",
        );
        expect(createServerClient).not.toHaveBeenCalled();
      });
    }
  }

  it("does not touch a marketing path", async () => {
    mockClient(null, null);

    const response = await updateSession(request("/about"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect /platform-disabled to itself", async () => {
    mockClient(null, null);

    const response = await updateSession(request("/platform-disabled"));

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("staff mode — the claims desk is open and authorization is unchanged", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "staff";
  });

  it("still sends a signed-out caller at /admin to /login", async () => {
    mockClient(null, null);

    const response = await updateSession(request("/admin/claims"));

    expect(response.headers.get("location")).toBe(
      "https://cmg.test/login?next=%2Fadmin%2Fclaims",
    );
  });

  it("still sends an aal1 staff session to /mfa — the second factor is not waived", async () => {
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

  it("refuses a session whose profile is unreadable, exactly as in platform mode", async () => {
    mockClient({ sub: "user-1", aal: "aal2" }, null);

    const response = await updateSession(request("/admin"));

    expect(response.headers.get("location")).toBe("https://cmg.test/login");
  });

  /**
   * Requirement: a customer or partner who does sign in must not land on an open
   * portal, and must not be bounced around a chain either. `landingPathFor`
   * resolves to `/platform-disabled` because their own prefix is closed, so the
   * refusal is one hop and terminal — `/platform-disabled` is not gated, so it
   * cannot redirect again.
   */
  it.each([
    ["customer", "customer"],
    ["partner", "partner"],
  ])("sends a %s at /admin straight to /platform-disabled", async (_label, role) => {
    mockClient({ sub: "user-1", aal: "aal2" }, role);

    const response = await updateSession(request("/admin/claims"));

    expect(response.headers.get("location")).toBe(
      "https://cmg.test/platform-disabled",
    );
  });

  it("carries a rotated session cookie onto that refusal", async () => {
    mockClient({ sub: "user-1", aal: "aal2" }, "customer", {
      name: "sb-access-token",
      value: "rotated-closed-surface",
    });

    const response = await updateSession(request("/admin"));

    expect(response.headers.get("location")).toBe(
      "https://cmg.test/platform-disabled",
    );
    expect(response.cookies.get("sb-access-token")?.value).toBe(
      "rotated-closed-surface",
    );
  });

  it.each(["/api/cron/outbox", "/api/pandadoc/webhook"])(
    "leaves %s ungated",
    async (path) => {
      mockClient(null, null);

      const response = await updateSession(request(path));

      expect(response.headers.get("location")).toBeNull();
    },
  );
});

/**
 * Password recovery has to work for someone who cannot sign in. The request form
 * and the emailed link are reached with no session at all, and the reset screen
 * with the aal1 recovery session `verifyOtp` creates — which, for a staff
 * account, is below the bar `/admin` sets. None of the three is a surface, so
 * the proxy must pass them through and leave the decision to the route itself.
 */
describe.each(["staff", "platform"])("password recovery routes — SITE_MODE=%s", (mode) => {
  beforeEach(() => {
    process.env.SITE_MODE = mode;
  });

  it.each(["/forgot-password", "/auth/confirm"])(
    "lets a signed-out visitor reach %s",
    async (path) => {
      mockClient(null, null);

      const response = await updateSession(request(path, "?token_hash=abc&type=recovery"));

      expect(response.headers.get("location")).toBeNull();
    },
  );

  it.each(["adjuster", "owner", "customer"])(
    "lets an aal1 recovery session for a %s reach /reset-password without a /mfa detour",
    async (role) => {
      mockClient({ sub: "user-1", aal: "aal1" }, role);

      const response = await updateSession(request("/reset-password"));

      expect(response.headers.get("location")).toBeNull();
    },
  );
});

describe("simple mode closes password recovery", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "simple";
  });

  it.each(["/forgot-password", "/auth/confirm", "/reset-password"])(
    "redirects %s to /platform-disabled, dropping the token from the URL",
    async (path) => {
      const response = await updateSession(
        request(path, "?token_hash=0123456789abcdef0123456789abcdef&type=recovery"),
      );

      expect(response.headers.get("location")).toBe("https://cmg.test/platform-disabled");
      expect(createServerClient).not.toHaveBeenCalled();
    },
  );
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
