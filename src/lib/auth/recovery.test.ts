import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  getSession: vi.fn(),
  getClaims: vi.fn(),
  listFactors: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ getSession: stub.getSession }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: stub.getClaims, mfa: { listFactors: stub.listFactors } },
  })),
}));

const {
  getRecoverySession,
  hasRecentRecovery,
  isWellFormedTokenHash,
  RECOVERY_SESSION_MAX_AGE_SECONDS,
  recoveryConfirmUrl,
} = await import("./recovery");

const NOW = Date.UTC(2026, 8, 22, 12, 0, 0);
const nowSeconds = Math.floor(NOW / 1000);
const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef01234567";

function recoveryClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: "user-1",
    aal: "aal1",
    amr: [{ method: "otp", timestamp: nowSeconds - 60 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.getSession.mockResolvedValue({
    userId: "user-1",
    email: "adjuster@cmg.test",
    aal: "aal1",
    role: "adjuster",
  });
  stub.getClaims.mockResolvedValue({ data: { claims: recoveryClaims() } });
  stub.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isWellFormedTokenHash", () => {
  it("accepts GoTrue's 56-character lowercase hex digest", () => {
    expect(isWellFormedTokenHash(HASH)).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["too short", "abc123"],
    ["uppercase", HASH.toUpperCase()],
    ["non-hex", `${HASH.slice(0, 55)}g`],
    ["markup", "<script>alert(1)</script>"],
    ["url-ish", "https://evil.test/0123456789abcdef0123456789abcdef"],
    ["too long", "a".repeat(129)],
    ["with whitespace", ` ${HASH}`],
  ])("refuses a %s value", (_label, value) => {
    expect(isWellFormedTokenHash(value)).toBe(false);
  });
});

describe("recoveryConfirmUrl", () => {
  it("builds our own /auth/confirm URL from NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.cmg.test/");
    expect(recoveryConfirmUrl(HASH)).toBe(
      `https://app.cmg.test/auth/confirm?token_hash=${HASH}&type=recovery`,
    );
  });

  it("falls back to localhost only outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(recoveryConfirmUrl(HASH)).toBe(
      `http://localhost:3000/auth/confirm?token_hash=${HASH}&type=recovery`,
    );
  });

  it("refuses to build a link in production without a site origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(recoveryConfirmUrl(HASH)).toBeNull();
  });
});

describe("hasRecentRecovery", () => {
  it("accepts a recent otp entry — the method GoTrue writes for a recovery link", () => {
    expect(hasRecentRecovery([{ method: "otp", timestamp: nowSeconds - 30 }], NOW)).toBe(true);
  });

  it("still accepts it after the TOTP step-up adds a second entry", () => {
    expect(
      hasRecentRecovery(
        [
          { method: "totp", timestamp: nowSeconds - 5 },
          { method: "otp", timestamp: nowSeconds - 30 },
        ],
        NOW,
      ),
    ).toBe(true);
  });

  it("refuses an ordinary password session", () => {
    expect(hasRecentRecovery([{ method: "password", timestamp: nowSeconds - 30 }], NOW)).toBe(
      false,
    );
  });

  it("refuses a recovery entry older than the window", () => {
    expect(
      hasRecentRecovery(
        [{ method: "otp", timestamp: nowSeconds - RECOVERY_SESSION_MAX_AGE_SECONDS - 1 }],
        NOW,
      ),
    ).toBe(false);
  });

  it("refuses the string form, which carries no timestamp", () => {
    expect(hasRecentRecovery(["otp"], NOW)).toBe(false);
  });

  it("refuses a missing claim", () => {
    expect(hasRecentRecovery(undefined, NOW)).toBe(false);
  });
});

describe("getRecoverySession", () => {
  it("returns the recovery session for an account without a verified factor", async () => {
    vi.stubEnv("SITE_MODE", "staff");

    await expect(getRecoverySession(NOW)).resolves.toEqual({
      userId: "user-1",
      email: "adjuster@cmg.test",
      aal: "aal1",
      role: "adjuster",
      factorId: null,
      needsCode: false,
    });
  });

  it("asks for a code when a verified TOTP factor exists and the session is aal1", async () => {
    vi.stubEnv("SITE_MODE", "staff");
    stub.listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-unverified", status: "unverified" }, { id: "factor-1", status: "verified" }] },
      error: null,
    });

    await expect(getRecoverySession(NOW)).resolves.toMatchObject({
      factorId: "factor-1",
      needsCode: true,
    });
  });

  it("stops asking once the session has stepped up to aal2", async () => {
    vi.stubEnv("SITE_MODE", "staff");
    stub.getSession.mockResolvedValue({
      userId: "user-1",
      email: "adjuster@cmg.test",
      aal: "aal2",
      role: "adjuster",
    });
    stub.listFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "verified" }] },
      error: null,
    });

    await expect(getRecoverySession(NOW)).resolves.toMatchObject({ needsCode: false });
  });

  it("refuses when there is no active session (none, or a deactivated profile)", async () => {
    vi.stubEnv("SITE_MODE", "staff");
    stub.getSession.mockResolvedValue(null);

    await expect(getRecoverySession(NOW)).resolves.toBeNull();
    expect(stub.getClaims).not.toHaveBeenCalled();
  });

  it("refuses an ordinary signed-in session", async () => {
    vi.stubEnv("SITE_MODE", "platform");
    stub.getClaims.mockResolvedValue({
      data: { claims: recoveryClaims({ amr: [{ method: "password", timestamp: nowSeconds }] }) },
    });

    await expect(getRecoverySession(NOW)).resolves.toBeNull();
  });

  it.each(["customer", "partner"])(
    "refuses a %s in staff mode, whose surface is closed",
    async (role) => {
      vi.stubEnv("SITE_MODE", "staff");
      stub.getSession.mockResolvedValue({
        userId: "user-1",
        email: "person@example.test",
        aal: "aal1",
        role,
      });

      await expect(getRecoverySession(NOW)).resolves.toBeNull();
    },
  );

  it("serves a customer in platform mode, where the portal is open", async () => {
    vi.stubEnv("SITE_MODE", "platform");
    stub.getSession.mockResolvedValue({
      userId: "user-1",
      email: "person@example.test",
      aal: "aal1",
      role: "customer",
    });

    await expect(getRecoverySession(NOW)).resolves.toMatchObject({ role: "customer" });
  });

  it("fails closed when the factor list cannot be read", async () => {
    vi.stubEnv("SITE_MODE", "staff");
    stub.listFactors.mockResolvedValue({ data: null, error: { message: "down" } });

    await expect(getRecoverySession(NOW)).resolves.toBeNull();
  });
});
