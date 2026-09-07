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

  /**
   * The old pattern was `^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}(%…)?$`, and `{0,4}`
   * let every group be empty. Each of these matched it, reached `audit_log.ip`
   * (an `inet`), and made Postgres answer `invalid input syntax for type inet` —
   * which `writeAudit` swallows on purpose, so the audit row for that request
   * just vanished. One header was enough to choose which requests went
   * unrecorded.
   */
  it("refuses colon runs that are not addresses, which used to reach the inet column", () => {
    for (const value of [":::", "::::::", "abcd::::::", "1:2:3:4:5:6:7:8:9", "::1::2"]) {
      expect(clientIpFromHeaders(xff(value), 1)).toBe(UNKNOWN_IP);
      expect(inetOrNull(value)).toBeNull();
    }
  });

  it("still accepts the IPv6 spellings that are real", () => {
    expect(clientIpFromHeaders(xff("::1"), 1)).toBe("::1");
    expect(clientIpFromHeaders(xff("2001:DB8::8:800:200C:417A"), 1)).toBe(
      "2001:db8::8:800:200c:417a",
    );
    expect(clientIpFromHeaders(xff("1:2:3:4:5:6:7:8"), 1)).toBe("1:2:3:4:5:6:7:8");
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

  it("passes an IPv4-mapped address through, which Postgres does accept", () => {
    expect(inetOrNull("::ffff:203.0.113.9")).toBe("::ffff:203.0.113.9");
  });

  it("returns null for a zone index, which inet has no syntax for", () => {
    expect(inetOrNull("fe80::1%eth0")).toBeNull();
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

  /**
   * Every caller limits *before* validating, so the identifier here is raw form
   * input and `rate_limits.key` is unbounded `text` in a primary key. A 3007
   * character key was accepted and stored by this build; past roughly 2700 bytes
   * the row stops fitting a btree tuple and the insert raises instead, at which
   * point `checkRateLimit` fails closed and the login form answers a malformed
   * submission with "too many attempts" — advice that can never come true.
   */
  it("caps a hostile identifier so the key cannot outgrow the index", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await checkRateLimit(RATE_LIMITS.loginEmail, "A".repeat(3000));

    const { p_key } = rpc.mock.calls[0][1];
    expect(p_key).toBe(`login:email:${"a".repeat(254)}`);
    expect(p_key.length).toBeLessThan(300);
  });

  it("leaves the longest legitimate identifier untouched", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    // RFC 5321 caps an address at 254 characters, which is where the cap is set,
    // so no real caller is ever truncated.
    const longest = `${"a".repeat(242)}@example.com`;
    expect(longest).toHaveLength(254);

    await checkRateLimit(RATE_LIMITS.loginEmail, longest);
    expect(rpc.mock.calls[0][1].p_key).toBe(`login:email:${longest}`);
  });

  it("still trims and lowercases before measuring", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await checkRateLimit(RATE_LIMITS.loginEmail, `   ${"B".repeat(260)}   `);
    expect(rpc.mock.calls[0][1].p_key).toBe(`login:email:${"b".repeat(254)}`);
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
