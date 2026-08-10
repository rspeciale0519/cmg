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

/**
 * These replace an assertion that codified the defect — the old suite required
 * `split(",")[0]`, which is the entry the client itself supplied. The header
 * grows by *appending*, so the trustworthy end is the right one, and the tests
 * below fix which end is read rather than relaxing what is checked.
 */
describe("clientIpFromHeaders", () => {
  const xff = (value: string) => new Headers({ "x-forwarded-for": value });

  it("reads the hop the trusted proxy appended, not the one the client sent", () => {
    // What a forged header looks like once one trusted proxy has appended the
    // attacker's real address on the right.
    const headers = xff("203.0.113.77, 10.0.0.5, 10.0.0.6, 198.51.100.22");
    expect(clientIpFromHeaders(headers, 1)).toBe("198.51.100.22");
  });

  it("counts in further when more proxies are trusted", () => {
    const headers = xff("203.0.113.9, 70.41.3.18, 150.172.238.178");
    expect(clientIpFromHeaders(headers, 1)).toBe("150.172.238.178");
    expect(clientIpFromHeaders(headers, 2)).toBe("70.41.3.18");
    expect(clientIpFromHeaders(headers, 3)).toBe("203.0.113.9");
  });

  it("gives the same address whatever a client prepends, so the bucket is stable", () => {
    const first = clientIpFromHeaders(xff("1.2.3.4, 198.51.100.22"), 1);
    const second = clientIpFromHeaders(xff("5.6.7.8, 9.9.9.9, 198.51.100.22"), 1);
    expect(first).toBe(second);
  });

  it("uses the only entry a single-proxy chain produces", () => {
    expect(clientIpFromHeaders(xff("198.51.100.7"), 1)).toBe("198.51.100.7");
  });

  it("takes what it can when the chain is shorter than the configuration", () => {
    expect(clientIpFromHeaders(xff("198.51.100.7"), 3)).toBe("198.51.100.7");
  });

  it("steps left past an entry that is not an address", () => {
    expect(clientIpFromHeaders(xff("203.0.113.9, 198.51.100.7, unknown"), 1)).toBe(
      "198.51.100.7",
    );
  });

  it("strips a port and unwraps an IPv4-mapped address", () => {
    expect(clientIpFromHeaders(xff("198.51.100.7:41234"), 1)).toBe("198.51.100.7");
    expect(clientIpFromHeaders(xff("[2001:db8::1]:443"), 1)).toBe("2001:db8::1");
    expect(clientIpFromHeaders(xff("::ffff:198.51.100.7"), 1)).toBe("198.51.100.7");
  });

  it("refuses a value that is not an address, so the key space stays bounded", () => {
    expect(clientIpFromHeaders(xff("not-an-ip"), 1)).toBe(UNKNOWN_IP);
    expect(clientIpFromHeaders(xff("999.1.1.1"), 1)).toBe(UNKNOWN_IP);
    expect(clientIpFromHeaders(xff("x".repeat(200)), 1)).toBe(UNKNOWN_IP);
  });

  it("falls back to x-real-ip only when the trusted chain wrote nothing", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
    expect(
      clientIpFromHeaders(
        new Headers({
          "x-forwarded-for": "203.0.113.77, 198.51.100.22",
          "x-real-ip": "203.0.113.99",
        }),
        1,
      ),
    ).toBe("198.51.100.22");
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
