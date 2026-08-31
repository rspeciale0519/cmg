import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./csp";

describe("contentSecurityPolicy", () => {
  it("enforces a nonce without allowing inline scripts", () => {
    const policy = contentSecurityPolicy("nonce-value", false);

    expect(policy).toContain("script-src 'self' 'nonce-nonce-value' 'strict-dynamic'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("127.0.0.1");
  });

  it("allows only local development transports in development", () => {
    const policy = contentSecurityPolicy("dev", true);

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("http://127.0.0.1:15421");
    expect(policy).toContain("ws://127.0.0.1:15421");
  });

  it("does not upgrade loopback HTTP requests used for local production smoke tests", () => {
    const policy = contentSecurityPolicy("local", false, false);

    expect(policy).not.toContain("upgrade-insecure-requests");
    expect(policy).toContain("http://127.0.0.1:15421");
    expect(policy).not.toContain("'unsafe-eval'");
  });
});
