import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

const {
  checkFormRateLimits,
  checkRateLimit,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
  UNKNOWN_IP,
} = await import("./rate-limit");

beforeEach(() => {
  rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("clientIpFromHeaders", () => {
  it("takes the first entry of x-forwarded-for", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178",
    });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });

  it("returns the unknown bucket rather than nothing when no header is present", () => {
    expect(clientIpFromHeaders(new Headers())).toBe(UNKNOWN_IP);
  });

  it("ignores an empty x-forwarded-for", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "  " }))).toBe(UNKNOWN_IP);
  });
});

describe("inetOrNull", () => {
  it("passes an IPv4 address through", () => {
    expect(inetOrNull("203.0.113.9")).toBe("203.0.113.9");
  });

  it("passes an IPv6 address through", () => {
    expect(inetOrNull("2001:db8::1")).toBe("2001:db8::1");
  });

  it("returns null for the unknown bucket", () => {
    expect(inetOrNull(UNKNOWN_IP)).toBeNull();
  });

  it("returns null for a non-address", () => {
    expect(inetOrNull("not-an-ip")).toBeNull();
  });
});

describe("checkRateLimit", () => {
  it("namespaces and lowercases the key, and passes the rule through", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(checkRateLimit(RATE_LIMITS.intakeEmail, "Dana@Example.com")).resolves.toBe(
      true,
    );

    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "intake:email:dana@example.com",
      p_max: 3,
      p_window: "1 hour",
    });
  });

  it("returns false when the database says the budget is spent", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await expect(checkRateLimit(RATE_LIMITS.contactIp, "203.0.113.9")).resolves.toBe(false);
  });

  it("fails closed when the rpc errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(checkRateLimit(RATE_LIMITS.contactIp, "203.0.113.9")).resolves.toBe(false);
  });
});

describe("checkFormRateLimits", () => {
  const rules = {
    ipRule: RATE_LIMITS.intakeIp,
    emailRule: RATE_LIMITS.intakeEmail,
  };

  it("checks the IP and then the email", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      checkFormRateLimits({ ...rules, ip: "203.0.113.9", email: "dana@example.com" }),
    ).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1].p_key).toBe("intake:ip:203.0.113.9");
    expect(rpc.mock.calls[1][1].p_key).toBe("intake:email:dana@example.com");
  });

  it("does not spend the email budget once the IP is over limit", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      checkFormRateLimits({ ...rules, ip: "203.0.113.9", email: "dana@example.com" }),
    ).resolves.toBe(false);

    expect(rpc).toHaveBeenCalledOnce();
  });

  it("still checks the IP when no email is supplied", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(
      checkFormRateLimits({ ...rules, ip: UNKNOWN_IP, email: null }),
    ).resolves.toBe(true);

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0][1].p_key).toBe("intake:ip:unknown");
  });

  it("refuses when the email is over limit even though the IP is not", async () => {
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    await expect(
      checkFormRateLimits({ ...rules, ip: "203.0.113.9", email: "dana@example.com" }),
    ).resolves.toBe(false);
  });
});
