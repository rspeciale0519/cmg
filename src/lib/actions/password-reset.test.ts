import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two password-recovery actions.
 *
 * `requestPasswordReset` is exercised together with the real
 * `deliverPasswordReset` behind it — only the Supabase admin client and the
 * Resend transport are faked — so "same answer for every account" and "no email
 * for a customer in staff mode" are asserted on one path, the way a request
 * actually travels.
 */

const HASH = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba98";

const stub = vi.hoisted(() => ({
  calls: [] as string[],
  afterCallbacks: [] as (() => unknown)[],
  withinLimits: true,
  checkRateLimit: vi.fn(),
  turnstileOk: true,
  generateLink: vi.fn(),
  profile: vi.fn(),
  auditInserts: [] as Record<string, unknown>[],
  send: vi.fn(),
  resendSender: vi.fn(),
  getRecoverySession: vi.fn(),
  challengeAndVerify: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  isLeakedPassword: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("next/server", () => ({
  after: (callback: () => unknown) => {
    stub.afterCallbacks.push(callback);
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    passwordResetIp: { scope: "password-reset:ip", max: 10, window: "1 hour" },
    passwordResetEmail: { scope: "password-reset:email", max: 3, window: "1 hour" },
    passwordResetUser: { scope: "password-reset:user", max: 10, window: "15 minutes" },
    mfaVerifyUser: { scope: "mfa-verify:user", max: 10, window: "15 minutes" },
  },
  checkFormRateLimits: vi.fn(async (input: { ip: string; email: string | null }) => {
    stub.calls.push(`rate-limit:${input.ip}:${input.email}`);
    return stub.withinLimits;
  }),
  checkRateLimit: stub.checkRateLimit,
  clientIpFromHeaders: vi.fn(() => "203.0.113.9"),
  inetOrNull: vi.fn((value: string) => value),
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(async () => {
    stub.calls.push("turnstile");
    return stub.turnstileOk ? { ok: true } : { ok: false, reason: "rejected" };
  }),
}));
vi.mock("@/lib/email/outbox", () => ({ resendSender: stub.resendSender }));
vi.mock("@/lib/auth/leaked-password", () => ({ isLeakedPassword: stub.isLeakedPassword }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      mfa: { challengeAndVerify: stub.challengeAndVerify },
      updateUser: stub.updateUser,
      signOut: stub.signOut,
    },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        generateLink: async (params: unknown) => {
          stub.calls.push("generate-link");
          return stub.generateLink(params);
        },
      },
    },
    from: (table: string) => {
      if (table === "audit_log") {
        return {
          insert: async (row: Record<string, unknown>) => {
            stub.auditInserts.push(row);
            return { error: null };
          },
        };
      }
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ maybeSingle: stub.profile }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));
vi.mock("@/lib/auth/recovery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/recovery")>()),
  getRecoverySession: stub.getRecoverySession,
}));

const { requestPasswordReset, resetPassword } = await import("./password-reset");
const { PASSWORD_RESET_REQUESTED, idleState } = await import("./types");

function requestForm(email = "adjuster@cmg.test"): FormData {
  const data = new FormData();
  data.set("email", email);
  data.set("cf-turnstile-response", "single-use-token");
  return data;
}

async function runAfter(): Promise<void> {
  const callbacks = stub.afterCallbacks.splice(0);
  for (const callback of callbacks) await callback();
}

const GOOD_PASSWORD = "Tangerine-Harbor-47";

function resetForm(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("password", GOOD_PASSWORD);
  data.set("confirmPassword", GOOD_PASSWORD);
  for (const [key, value] of Object.entries(overrides)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.calls.length = 0;
  stub.afterCallbacks.length = 0;
  stub.auditInserts.length = 0;
  stub.withinLimits = true;
  stub.turnstileOk = true;
  vi.stubEnv("SITE_MODE", "staff");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.cmg.test");

  stub.generateLink.mockResolvedValue({
    data: {
      user: { id: "user-1", email: "adjuster@cmg.test" },
      properties: { hashed_token: HASH },
    },
    error: null,
  });
  stub.profile.mockResolvedValue({ data: { role: "adjuster", is_active: true }, error: null });
  stub.send.mockResolvedValue(undefined);
  stub.resendSender.mockResolvedValue(stub.send);

  stub.checkRateLimit.mockResolvedValue(true);
  stub.isLeakedPassword.mockResolvedValue(false);
  stub.getRecoverySession.mockResolvedValue({
    userId: "user-1",
    email: "adjuster@cmg.test",
    aal: "aal1",
    role: "adjuster",
    factorId: null,
    needsCode: false,
  });
  stub.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  stub.updateUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  stub.signOut.mockResolvedValue({ error: null });

  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("requestPasswordReset — gate order", () => {
  it("runs rate limit, then Turnstile, then validation, then the work — after the response", async () => {
    const state = await requestPasswordReset(idleState, requestForm());

    expect(state).toEqual({ status: "success", message: PASSWORD_RESET_REQUESTED });
    // The account work has not happened yet: it is deferred past the response.
    expect(stub.calls).toEqual(["rate-limit:203.0.113.9:adjuster@cmg.test", "turnstile"]);
    expect(stub.generateLink).not.toHaveBeenCalled();

    await runAfter();
    expect(stub.calls).toEqual([
      "rate-limit:203.0.113.9:adjuster@cmg.test",
      "turnstile",
      "generate-link",
    ]);
  });

  it("refuses a rate-limited request before spending a Turnstile verification, echoing the email", async () => {
    stub.withinLimits = false;

    const state = await requestPasswordReset(idleState, requestForm("someone@example.test"));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/several submissions/i);
    expect(state.values).toEqual({ email: "someone@example.test" });
    expect(stub.calls).toEqual(["rate-limit:203.0.113.9:someone@example.test"]);
    expect(stub.afterCallbacks).toHaveLength(0);
  });

  it("refuses a failed Turnstile check before validation or any account work, echoing the email", async () => {
    stub.turnstileOk = false;

    const state = await requestPasswordReset(idleState, requestForm("someone@example.test"));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/verify that you're a person/i);
    expect(state.values).toEqual({ email: "someone@example.test" });
    expect(stub.afterCallbacks).toHaveLength(0);
  });

  it("rejects a malformed address after the abuse gates, echoing what was typed", async () => {
    const state = await requestPasswordReset(idleState, requestForm("not-an-address"));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBe("Enter a valid email address.");
    expect(state.values).toEqual({ email: "not-an-address" });
    expect(stub.calls).toEqual(["rate-limit:203.0.113.9:not-an-address", "turnstile"]);
    expect(stub.afterCallbacks).toHaveLength(0);
  });

  it("spends the per-IP budget even when the email field is empty", async () => {
    const state = await requestPasswordReset(idleState, requestForm(""));

    expect(stub.calls[0]).toBe("rate-limit:203.0.113.9:null");
    expect(state.fieldErrors?.email).toBeDefined();
  });

  it("normalises the address before looking it up", async () => {
    await requestPasswordReset(idleState, requestForm("  Adjuster@CMG.Test "));
    await runAfter();

    expect(stub.generateLink).toHaveBeenCalledWith({ type: "recovery", email: "adjuster@cmg.test" });
  });
});

describe("requestPasswordReset — one answer for every account", () => {
  const cases = [
    ["an active staff account", () => {}, true],
    [
      "an unknown address",
      () =>
        stub.generateLink.mockResolvedValue({
          data: { user: null, properties: null },
          error: { code: "user_not_found", status: 404, message: "not found" },
        }),
      false,
    ],
    [
      "a deactivated account",
      () => stub.profile.mockResolvedValue({ data: { role: "owner", is_active: false }, error: null }),
      false,
    ],
    [
      "a customer in staff mode",
      () => stub.profile.mockResolvedValue({ data: { role: "customer", is_active: true }, error: null }),
      false,
    ],
    [
      "a partner in staff mode",
      () => stub.profile.mockResolvedValue({ data: { role: "partner", is_active: true }, error: null }),
      false,
    ],
    ["a delivery failure", () => stub.send.mockRejectedValue(new Error("provider down")), true],
    [
      "an auth outage",
      () => stub.generateLink.mockRejectedValue(new TypeError("fetch failed")),
      false,
    ],
  ] as const;

  it.each(cases)("answers %s with the generic sentence", async (_label, arrange, attempted) => {
    arrange();

    const state = await requestPasswordReset(idleState, requestForm());
    await runAfter();

    expect(state).toEqual({ status: "success", message: PASSWORD_RESET_REQUESTED });
    expect(state.message).toBe(
      "If an account exists for that email, we sent a link to reset the password.",
    );
    expect(stub.send.mock.calls.length > 0).toBe(attempted);
  });

  it("sends nothing to a customer in staff mode, but does in platform mode", async () => {
    stub.profile.mockResolvedValue({ data: { role: "customer", is_active: true }, error: null });

    await requestPasswordReset(idleState, requestForm("home@example.test"));
    await runAfter();
    expect(stub.send).not.toHaveBeenCalled();

    vi.stubEnv("SITE_MODE", "platform");
    await requestPasswordReset(idleState, requestForm("home@example.test"));
    await runAfter();
    expect(stub.send).toHaveBeenCalledOnce();
  });

  it("keeps the token out of the audit row", async () => {
    await requestPasswordReset(idleState, requestForm());
    await runAfter();

    expect(stub.auditInserts).toHaveLength(1);
    expect(stub.auditInserts[0]).toMatchObject({
      action: "auth.password_reset_requested",
      meta: { email: "adjuster@cmg.test", outcome: "sent" },
    });
    expect(JSON.stringify(stub.auditInserts)).not.toContain(HASH);
  });
});

describe("requestPasswordReset — site mode", () => {
  it.each(["simple", "", "unknown"])(
    "is closed when SITE_MODE=%j, before any gate or data call",
    async (mode) => {
      vi.stubEnv("SITE_MODE", mode);

      await expect(requestPasswordReset(idleState, requestForm())).rejects.toThrow(
        "redirect:/platform-disabled",
      );
      expect(stub.calls).toEqual([]);
    },
  );
});

describe("resetPassword", () => {
  it("sets the password, audits it, signs out globally and sends the person to sign in", async () => {
    await expect(resetPassword(idleState, resetForm())).rejects.toThrow(
      "redirect:/login?notice=password-reset",
    );

    expect(stub.updateUser).toHaveBeenCalledWith({ password: GOOD_PASSWORD });
    expect(stub.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(stub.challengeAndVerify).not.toHaveBeenCalled();
    expect(stub.auditInserts).toEqual([
      expect.objectContaining({
        actor_id: "user-1",
        action: "auth.password_reset_completed",
        meta: { mfa_step_up: false },
      }),
    ]);
    // The update happens before the sign-out, never after it.
    expect(stub.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      stub.signOut.mock.invocationCallOrder[0],
    );
  });

  it("sends a missing or stale recovery session to the generic expired notice", async () => {
    stub.getRecoverySession.mockResolvedValue(null);

    await expect(resetPassword(idleState, resetForm())).rejects.toThrow(
      "redirect:/forgot-password?notice=link-expired",
    );
    expect(stub.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["too short", "Short1a", "Use at least 12 characters."],
    ["missing a digit", "NoDigitsHereAtAll", "Include at least one number."],
    ["a guessable word", "Welcome-Harbor-47", "This contains a word attackers guess first. Choose something else."],
  ])("applies the invite password policy — %s", async (_label, password, message) => {
    const state = await resetPassword(
      idleState,
      resetForm({ password, confirmPassword: password }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.password).toBe(message);
    expect(state.values).toBeUndefined();
    expect(stub.updateUser).not.toHaveBeenCalled();
  });

  it("refuses a password built from the account's own address", async () => {
    stub.getRecoverySession.mockResolvedValue({
      userId: "user-1",
      email: "dana.whitfield@example.test",
      aal: "aal1",
      role: "adjuster",
      factorId: null,
      needsCode: false,
    });

    const state = await resetPassword(
      idleState,
      resetForm({ password: "Dana.Whitfield-47", confirmPassword: "Dana.Whitfield-47" }),
    );

    expect(state.fieldErrors?.password).toBe(
      "Do not build your password out of your own email address.",
    );
    expect(stub.updateUser).not.toHaveBeenCalled();
  });

  it("requires the two passwords to match", async () => {
    const state = await resetPassword(
      idleState,
      resetForm({ confirmPassword: "Tangerine-Harbor-48" }),
    );

    expect(state.fieldErrors?.confirmPassword).toBe("Both passwords must match.");
    expect(stub.updateUser).not.toHaveBeenCalled();
  });

  it("refuses a password found in a breach", async () => {
    stub.isLeakedPassword.mockResolvedValue(true);

    const state = await resetPassword(idleState, resetForm());

    expect(state.fieldErrors?.password).toMatch(/known data breach/);
    expect(stub.updateUser).not.toHaveBeenCalled();
  });

  it("refuses when the per-user budget is spent", async () => {
    stub.checkRateLimit.mockResolvedValue(false);

    const state = await resetPassword(idleState, resetForm());

    expect(state.message).toMatch(/several submissions/i);
    expect(stub.updateUser).not.toHaveBeenCalled();
  });

  it("answers an update failure generically and does not sign out", async () => {
    stub.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "unexpected_failure", message: "internal detail" },
    });

    const state = await resetPassword(idleState, resetForm());

    expect(state.status).toBe("error");
    expect(state.message).not.toContain("internal detail");
    expect(stub.signOut).not.toHaveBeenCalled();
    expect(stub.auditInserts).toEqual([
      expect.objectContaining({
        action: "auth.password_reset_refused",
        meta: { reason: "unexpected_failure" },
      }),
    ]);
  });

  it("tells the person to choose a different password when GoTrue says it is unchanged", async () => {
    stub.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: "same_password", message: "same" },
    });

    const state = await resetPassword(idleState, resetForm());

    expect(state.fieldErrors?.password).toMatch(/not already using/);
  });

  it("still sends the person to sign in when the global sign-out fails", async () => {
    stub.signOut.mockResolvedValue({ error: { code: "unexpected_failure" } });

    await expect(resetPassword(idleState, resetForm())).rejects.toThrow(
      "redirect:/login?notice=password-reset",
    );
  });

  describe("with a verified TOTP factor (recovery sessions are aal1)", () => {
    beforeEach(() => {
      stub.getRecoverySession.mockResolvedValue({
        userId: "user-1",
        email: "adjuster@cmg.test",
        aal: "aal1",
        role: "adjuster",
        factorId: "factor-1",
        needsCode: true,
      });
    });

    it("steps up with the code before updating the password", async () => {
      await expect(
        resetPassword(idleState, resetForm({ code: "123 456" })),
      ).rejects.toThrow("redirect:/login?notice=password-reset");

      expect(stub.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
      expect(stub.challengeAndVerify.mock.invocationCallOrder[0]).toBeLessThan(
        stub.updateUser.mock.invocationCallOrder[0],
      );
      expect(stub.checkRateLimit).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "mfa-verify:user" }),
        "user-1",
      );
      expect(stub.auditInserts.at(-1)).toMatchObject({
        action: "auth.password_reset_completed",
        meta: { mfa_step_up: true },
      });
    });

    it("refuses a missing or malformed code without calling Auth", async () => {
      const state = await resetPassword(idleState, resetForm({ code: "12ab" }));

      expect(state.fieldErrors?.code).toMatch(/code was not accepted/);
      expect(stub.challengeAndVerify).not.toHaveBeenCalled();
      expect(stub.updateUser).not.toHaveBeenCalled();
    });

    it("refuses a wrong code, audits it, and leaves the password alone", async () => {
      stub.challengeAndVerify.mockResolvedValue({
        data: null,
        error: { code: "mfa_verification_failed" },
      });

      const state = await resetPassword(idleState, resetForm({ code: "000000" }));

      expect(state.fieldErrors?.code).toMatch(/code was not accepted/);
      expect(stub.updateUser).not.toHaveBeenCalled();
      expect(stub.signOut).not.toHaveBeenCalled();
      expect(stub.auditInserts).toEqual([
        expect.objectContaining({
          action: "auth.mfa_verify_failed",
          meta: expect.objectContaining({ surface: "password_reset" }),
        }),
      ]);
    });

    it("bounds code guesses with the shared MFA budget", async () => {
      stub.checkRateLimit.mockImplementation(async (rule: { scope: string }) =>
        rule.scope !== "mfa-verify:user",
      );

      const state = await resetPassword(idleState, resetForm({ code: "123456" }));

      expect(state.message).toMatch(/several submissions/i);
      expect(stub.challengeAndVerify).not.toHaveBeenCalled();
    });
  });

  it.each(["simple", "unknown"])("is closed when SITE_MODE=%j", async (mode) => {
    vi.stubEnv("SITE_MODE", mode);

    await expect(resetPassword(idleState, resetForm())).rejects.toThrow(
      "redirect:/platform-disabled",
    );
    expect(stub.getRecoverySession).not.toHaveBeenCalled();
  });
});
