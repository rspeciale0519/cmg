// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `/auth/confirm` — where the emailed recovery link lands.
 *
 * Pinned: the token is verified with the user-scoped SSR client and the session
 * cookies it writes are on the redirect that is returned; every failure is one
 * redirect to one generic notice; nothing from the query string is reflected;
 * and the route is closed with the rest of sign-in in simple mode.
 */

const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef01234567";

const stub = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  createServerClient: vi.fn(),
  auditInserts: [] as Record<string, unknown>[],
  allowRate: true,
  checkRateLimit: vi.fn(async () => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => stub.createServerClient(...args),
}));
vi.mock("@/lib/authz", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        stub.auditInserts.push(row);
        return { error: null };
      },
    }),
  }),
}));
vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>(
    "@/lib/rate-limit",
  );
  return {
    ...actual,
    checkRateLimit: stub.checkRateLimit,
  };
});

const { GET } = await import("./route");

type CookieOptions = {
  cookies: {
    getAll: () => { name: string; value: string }[];
    setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void;
  };
};

/** The fake client writes the session cookie during `verifyOtp`, as the real one does. */
function mockVerify(result: unknown, writesCookie = true) {
  stub.createServerClient.mockImplementation(
    (_url: string, _key: string, options: CookieOptions) => ({
      auth: {
        verifyOtp: async (params: unknown) => {
          stub.verifyOtp(params);
          if (writesCookie) {
            options.cookies.setAll([
              { name: "sb-127-auth-token", value: "recovery-session", options: { path: "/" } },
            ]);
          }
          return result;
        },
      },
    }),
  );
}

const SUCCESS = {
  data: { user: { id: "user-1" }, session: { access_token: "jwt" } },
  error: null,
};

function request(search: string): NextRequest {
  return new NextRequest(new Request(`https://cmg.test/auth/confirm${search}`, {
    headers: { "x-forwarded-for": "203.0.113.9" },
  }));
}

const EXPIRED = "https://cmg.test/forgot-password?notice=link-expired";

beforeEach(() => {
  vi.clearAllMocks();
  stub.auditInserts.length = 0;
  stub.allowRate = true;
  stub.checkRateLimit.mockImplementation(async () => stub.allowRate);
  process.env.SITE_MODE = "staff";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:15421";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
  mockVerify(SUCCESS);
});

afterEach(() => {
  delete process.env.SITE_MODE;
});

describe("GET /auth/confirm — valid link", () => {
  it("verifies the token server-side and lands on /reset-password with the session cookie", async () => {
    const response = await GET(request(`?token_hash=${HASH}&type=recovery`));

    expect(stub.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: HASH });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://cmg.test/reset-password");
    expect(response.cookies.get("sb-127-auth-token")?.value).toBe("recovery-session");
  });

  it("does not let the consumed URL be cached or sent on as a Referer", async () => {
    const response = await GET(request(`?token_hash=${HASH}&type=recovery`));

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("audits the verification without the token", async () => {
    await GET(request(`?token_hash=${HASH}&type=recovery`));

    expect(stub.auditInserts).toEqual([
      expect.objectContaining({
        actor_id: "user-1",
        action: "auth.password_reset_link_verified",
        ip: "203.0.113.9",
      }),
    ]);
    expect(JSON.stringify(stub.auditInserts)).not.toContain(HASH);
  });

  it("works in platform mode too", async () => {
    process.env.SITE_MODE = "platform";

    const response = await GET(request(`?token_hash=${HASH}&type=recovery`));

    expect(response.headers.get("location")).toBe("https://cmg.test/reset-password");
  });
});

describe("GET /auth/confirm — refused links", () => {
  it.each([
    ["no parameters", ""],
    ["no token", "?type=recovery"],
    ["no type", `?token_hash=${HASH}`],
    ["an empty token", "?token_hash=&type=recovery"],
    ["another OTP type", `?token_hash=${HASH}&type=magiclink`],
    ["a signup type", `?token_hash=${HASH}&type=signup`],
    ["a non-hex token", "?token_hash=%3Cscript%3Ealert(1)%3C%2Fscript%3E&type=recovery"],
    ["a short token", "?token_hash=abc&type=recovery"],
    ["a repeated token", `?token_hash=${HASH}&token_hash=${HASH}&type=recovery`],
    ["a repeated type", `?token_hash=${HASH}&type=recovery&type=recovery`],
  ])("sends %s to the generic notice without calling Auth", async (_label, search) => {
    const response = await GET(request(search));

    expect(response.headers.get("location")).toBe(EXPIRED);
    expect(stub.createServerClient).not.toHaveBeenCalled();
    expect(response.cookies.getAll()).toEqual([]);
  });

  it.each([
    ["expired", { code: "otp_expired", status: 403, message: "Email link is invalid or has expired" }],
    ["already used", { code: "otp_expired", status: 403, message: "Email link is invalid or has expired" }],
    ["rejected for another reason", { code: "unexpected_failure", status: 500, message: "boom" }],
  ])("sends an %s token to the same notice, without a session cookie", async (_label, error) => {
    mockVerify({ data: { user: null, session: null }, error }, false);

    const response = await GET(request(`?token_hash=${HASH}&type=recovery`));

    expect(stub.verifyOtp).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe(EXPIRED);
    expect(response.cookies.getAll()).toEqual([]);
    expect(stub.auditInserts).toEqual([]);
  });

  it("treats a verification that returns no session as a failure", async () => {
    mockVerify({ data: { user: { id: "user-1" }, session: null }, error: null }, false);

    const response = await GET(request(`?token_hash=${HASH}&type=recovery`));

    expect(response.headers.get("location")).toBe(EXPIRED);
  });

  it("treats a thrown verification as a failure rather than a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stub.createServerClient.mockImplementation(() => ({
      auth: {
        verifyOtp: async () => {
          throw new TypeError("fetch failed");
        },
      },
    }));

    const response = await GET(request(`?token_hash=${HASH}&type=recovery`));

    expect(response.headers.get("location")).toBe(EXPIRED);
  });

  it("never reflects the query string into the redirect", async () => {
    const response = await GET(request("?token_hash=evil&type=recovery&next=https://evil.test"));

    expect(response.headers.get("location")).toBe(EXPIRED);
    expect(response.headers.get("location")).not.toContain("evil");
  });
});

describe("GET /auth/confirm — rate limit", () => {
  it("does not call Auth when the IP budget is spent, and uses the same notice as a bad token", async () => {
    stub.allowRate = false;

    const response = await GET(request(`?token_hash=${HASH}&type=recovery`));

    expect(response.headers.get("location")).toBe(EXPIRED);
    expect(stub.createServerClient).not.toHaveBeenCalled();
    expect(stub.verifyOtp).not.toHaveBeenCalled();
    expect(stub.auditInserts).toEqual([]);
  });

  it("does not spend the budget on a malformed token", async () => {
    const response = await GET(request("?token_hash=abc&type=recovery"));

    expect(response.headers.get("location")).toBe(EXPIRED);
    expect(stub.checkRateLimit).not.toHaveBeenCalled();
  });
});

describe("GET /auth/confirm — site mode", () => {
  it.each(["simple", "", "not-a-mode"])(
    "is closed when SITE_MODE=%j, before Auth is called",
    async (mode) => {
      process.env.SITE_MODE = mode;

      const response = await GET(request(`?token_hash=${HASH}&type=recovery`));

      expect(response.headers.get("location")).toBe("https://cmg.test/platform-disabled");
      expect(stub.createServerClient).not.toHaveBeenCalled();
    },
  );
});
