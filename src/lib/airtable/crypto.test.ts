// @vitest-environment node
import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "./crypto";
describe("Airtable encrypted credentials", () => {
  const key = Buffer.alloc(32, 11).toString("base64");
  it("binds ciphertext to its company and detects tampering", () => {
    const value = sealSecret("synthetic-secret", "company-1", key);
    expect(value).not.toContain("synthetic-secret");
    expect(openSecret(value, "company-1", key)).toBe("synthetic-secret");
    expect(() => openSecret(value, "company-2", key)).toThrow();
    expect(() => openSecret(value.slice(0,-3)+"AAA", "company-1", key)).toThrow();
  });
  it("uses a new nonce and refuses an invalid key", () => {
    expect(sealSecret("x","company",key)).not.toBe(sealSecret("x","company",key));
    expect(() => sealSecret("x","company","short")).toThrow();
  });
});
