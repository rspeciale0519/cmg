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

  it.each([[true, true], [false, false]])("allows the isolated loopback Storage port in local mode", (development, upgrade) => {
    const policy = contentSecurityPolicy("local", development, upgrade, "http://127.0.0.1:15521/storage/v1");
    expect(policy).toContain("http://127.0.0.1:15521 ws://127.0.0.1:15521");
    expect(policy).not.toContain("15521/storage");
  });

  it.each(["http://localhost:15521", "http://[::1]:15521"])("allows a configured loopback origin %s", (origin) => {
    expect(contentSecurityPolicy("local", true, false, origin)).toContain(origin);
  });

  it.each(["http://example.com:15521", "http://127.0.0.1.example.com:15521", "http://user:pass@127.0.0.1:15521", "not-a-url", "http://127.0.0.1:15521; connect-src *"])("rejects unsafe local Storage configuration %s", (origin) => {
    const policy = contentSecurityPolicy("local", true, false, origin);
    expect(policy).not.toContain("15521");
    expect(policy).not.toContain("connect-src *");
  });

  it("keeps configured loopback transports out of hosted production", () => {
    const policy = contentSecurityPolicy("hosted", false, true, "http://127.0.0.1:15521");
    expect(policy).not.toContain("127.0.0.1");
    expect(policy).toContain("upgrade-insecure-requests");
  });
});
