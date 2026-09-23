import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract this pins: **an email with a recovery link goes out only for an
 * active account whose own surface is open in this mode, and the link never
 * reaches a table or a log.**
 *
 * The action in front of this answers every caller with the same sentence
 * before any of this runs, so what is asserted here is what happened behind it:
 * the send, and the audit row that records the outcome without the token.
 */

const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef01234567";

const stub = vi.hoisted(() => ({
  generateLink: vi.fn(),
  profile: vi.fn(),
  auditInserts: [] as Record<string, unknown>[],
  outboxWrites: vi.fn(),
  send: vi.fn(),
  resendSender: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/email/outbox", () => ({ resendSender: stub.resendSender }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { generateLink: stub.generateLink } },
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
        return {
          select: () => ({ eq: () => ({ maybeSingle: stub.profile }) }),
        };
      }
      stub.outboxWrites(table);
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const { deliverPasswordReset } = await import("./password-reset-delivery");

function linkFor(email = "adjuster@cmg.test") {
  return {
    data: {
      user: { id: "user-1", email },
      properties: {
        hashed_token: HASH,
        action_link: `https://project.supabase.co/auth/v1/verify?token=${HASH}`,
        email_otp: "907315",
      },
    },
    error: null,
  };
}

function everythingLogged(spies: ReturnType<typeof vi.spyOn>[]): string {
  return JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
}

let logSpies: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  vi.clearAllMocks();
  stub.auditInserts.length = 0;
  vi.stubEnv("SITE_MODE", "staff");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.cmg.test");
  stub.generateLink.mockResolvedValue(linkFor());
  stub.profile.mockResolvedValue({ data: { role: "adjuster", is_active: true }, error: null });
  stub.send.mockResolvedValue(undefined);
  stub.resendSender.mockResolvedValue(stub.send);
  logSpies = [
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "info").mockImplementation(() => {}),
    vi.spyOn(console, "log").mockImplementation(() => {}),
  ];
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const spy of logSpies) spy.mockRestore();
});

describe("deliverPasswordReset — who gets an email", () => {
  it("sends our own /auth/confirm link to an active staff account in staff mode", async () => {
    await expect(deliverPasswordReset("adjuster@cmg.test", "203.0.113.9")).resolves.toBe("sent");

    expect(stub.generateLink).toHaveBeenCalledWith({ type: "recovery", email: "adjuster@cmg.test" });
    expect(stub.send).toHaveBeenCalledOnce();
    const message = stub.send.mock.calls[0][0];
    expect(message.to).toBe("adjuster@cmg.test");
    expect(message.subject).toBe("Reset your CMG password");
    expect(message.text).toContain(
      `https://app.cmg.test/auth/confirm?token_hash=${HASH}&type=recovery`,
    );
    // Supabase's own verify endpoint is never what the person is sent.
    expect(message.html).not.toContain("/auth/v1/verify");
    expect(message.text).not.toContain("907315");
    expect(typeof message.idempotencyKey).toBe("string");
  });

  it("sends to the address GoTrue holds rather than the typed spelling", async () => {
    stub.generateLink.mockResolvedValue(linkFor("Adjuster@CMG.test"));

    await deliverPasswordReset("adjuster@cmg.test", null);

    expect(stub.send.mock.calls[0][0].to).toBe("Adjuster@CMG.test");
  });

  it.each(["customer", "partner"])(
    "sends nothing to a %s in staff mode, whose portal is closed",
    async (role) => {
      stub.profile.mockResolvedValue({ data: { role, is_active: true }, error: null });

      await expect(deliverPasswordReset("person@example.test", null)).resolves.toBe(
        "surface_closed",
      );
      expect(stub.send).not.toHaveBeenCalled();
      expect(stub.resendSender).not.toHaveBeenCalled();
    },
  );

  it.each(["customer", "partner", "owner"])("sends to a %s in platform mode", async (role) => {
    vi.stubEnv("SITE_MODE", "platform");
    stub.profile.mockResolvedValue({ data: { role, is_active: true }, error: null });

    await expect(deliverPasswordReset("person@example.test", null)).resolves.toBe("sent");
    expect(stub.send).toHaveBeenCalledOnce();
  });

  it("sends nothing for an address with no account", async () => {
    stub.generateLink.mockResolvedValue({
      data: { user: null, properties: null },
      error: { code: "user_not_found", status: 404, message: "User with this email not found" },
    });

    await expect(deliverPasswordReset("nobody@example.test", null)).resolves.toBe("no_account");
    expect(stub.profile).not.toHaveBeenCalled();
    expect(stub.send).not.toHaveBeenCalled();
  });

  it("sends nothing for a deactivated account", async () => {
    stub.profile.mockResolvedValue({ data: { role: "adjuster", is_active: false }, error: null });

    await expect(deliverPasswordReset("adjuster@cmg.test", null)).resolves.toBe("inactive");
    expect(stub.send).not.toHaveBeenCalled();
  });

  it("sends nothing for an account with no profile", async () => {
    stub.profile.mockResolvedValue({ data: null, error: null });

    await expect(deliverPasswordReset("adjuster@cmg.test", null)).resolves.toBe("inactive");
    expect(stub.send).not.toHaveBeenCalled();
  });

  it("sends nothing when the profile read fails", async () => {
    stub.profile.mockResolvedValue({ data: null, error: { code: "57014" } });

    await expect(deliverPasswordReset("adjuster@cmg.test", null)).resolves.toBe("lookup_failed");
    expect(stub.send).not.toHaveBeenCalled();
  });

  it("sends nothing and reports it when delivery is not configured", async () => {
    stub.resendSender.mockResolvedValue(null);

    await expect(deliverPasswordReset("adjuster@cmg.test", null)).resolves.toBe(
      "delivery_unconfigured",
    );
  });

  it("refuses to mail a localhost link from a production build with no site origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    await expect(deliverPasswordReset("adjuster@cmg.test", null)).resolves.toBe(
      "site_url_missing",
    );
    expect(stub.send).not.toHaveBeenCalled();
  });

  it("does not retry a failed send, and does not throw", async () => {
    stub.send.mockRejectedValue(new Error(`provider said no to ${HASH}`));

    await expect(deliverPasswordReset("adjuster@cmg.test", null)).resolves.toBe("send_failed");
    expect(stub.send).toHaveBeenCalledOnce();
  });

  it("reports a generateLink failure other than a missing user", async () => {
    stub.generateLink.mockResolvedValue({
      data: { user: null, properties: null },
      error: { code: "unexpected_failure", status: 500, message: "boom" },
    });

    await expect(deliverPasswordReset("adjuster@cmg.test", null)).resolves.toBe("link_failed");
  });

  it("does not throw when the auth client itself throws", async () => {
    stub.generateLink.mockRejectedValue(new TypeError("fetch failed"));

    await expect(deliverPasswordReset("adjuster@cmg.test", null)).resolves.toBe("error");
  });
});

describe("deliverPasswordReset — the token never lands anywhere but the email", () => {
  it.each([
    ["sent", () => {}],
    [
      "send_failed",
      () => stub.send.mockRejectedValue(new Error(`provider echoed ${HASH}`)),
    ],
    [
      "surface_closed",
      () => stub.profile.mockResolvedValue({ data: { role: "customer", is_active: true }, error: null }),
    ],
    ["delivery_unconfigured", () => stub.resendSender.mockResolvedValue(null)],
  ] as const)("writes one audit row without the token (%s)", async (outcome, arrange) => {
    arrange();

    await deliverPasswordReset("adjuster@cmg.test", "203.0.113.9");

    expect(stub.auditInserts).toHaveLength(1);
    const row = stub.auditInserts[0];
    expect(row).toMatchObject({
      action: "auth.password_reset_requested",
      entity: "auth",
      entity_id: "user-1",
      ip: "203.0.113.9",
      meta: { email: "adjuster@cmg.test", outcome },
    });
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain(HASH);
    expect(serialised).not.toContain("token_hash");
    expect(serialised).not.toContain("907315");
    expect(everythingLogged(logSpies)).not.toContain(HASH);
  });

  it("audits an unknown address with no user id", async () => {
    stub.generateLink.mockResolvedValue({
      data: { user: null, properties: null },
      error: { code: "user_not_found", status: 404, message: "not found" },
    });

    await deliverPasswordReset("nobody@example.test", null);

    expect(stub.auditInserts).toEqual([
      expect.objectContaining({
        action: "auth.password_reset_requested",
        entity_id: null,
        meta: { email: "nobody@example.test", outcome: "no_account" },
      }),
    ]);
  });

  it("never touches notifications_outbox", async () => {
    await deliverPasswordReset("adjuster@cmg.test", null);

    expect(stub.outboxWrites).not.toHaveBeenCalled();
  });
});
