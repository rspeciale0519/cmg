import { describe, expect, it } from "vitest";
import { safeNextPath } from "./roles";

/**
 * `?next=` is applied after sign-in and after MFA, including when a session
 * already exists and `/login` or `/mfa` immediately redirects. A value that
 * WHATWG parsers resolve off-origin is an open redirect.
 */
describe("safeNextPath", () => {
  it("keeps an ordinary same-origin path, including query and hash", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/portal/claims/20000000-0000-4000-a000-000000000001")).toBe(
      "/portal/claims/20000000-0000-4000-a000-000000000001",
    );
    expect(safeNextPath("/admin/claims/x?tab=documents")).toBe(
      "/admin/claims/x?tab=documents",
    );
    expect(safeNextPath("/partner#queue")).toBe("/partner#queue");
  });

  it.each([
    ["protocol-relative", "//evil.test"],
    ["triple slash", "///evil.test"],
    ["backslash as slash", "/\\evil.test"],
    ["tab then protocol-relative", "/\t//evil.test"],
    ["line-feed then protocol-relative", "/\n//evil.test"],
    ["CR then protocol-relative", "/\r//evil.test"],
    ["CRLF header injection", "/\r\nLocation: https://evil.test"],
    ["space then protocol-relative", "/ //evil.test"],
    ["absolute https", "https://evil.test"],
    ["absolute http", "http://evil.test"],
    ["missing leading slash", "admin"],
    ["empty", ""],
  ])("refuses %s", (_label, value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("refuses the decoded form of /%09//evil.test and /%0a//evil.test", () => {
    expect(safeNextPath(decodeURIComponent("/%09//evil.test"))).toBeNull();
    expect(safeNextPath(decodeURIComponent("/%0a//evil.test"))).toBeNull();
  });

  it("never returns a value whose URL origin leaves the dummy base", () => {
    const attacks = [
      "//evil.test",
      "///evil.test",
      "/\t//evil.test",
      "/\n//evil.test",
      "/\\evil.test",
      "https://evil.test",
    ];
    for (const attack of attacks) {
      const allowed = safeNextPath(attack);
      if (allowed === null) continue;
      const parsed = new URL(allowed, "https://cmg.invalid");
      expect(parsed.origin, attack).toBe("https://cmg.invalid");
    }
  });
});
