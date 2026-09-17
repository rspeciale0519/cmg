import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("LOR signer query shape", () => {
  it("orders deterministically and reads no more signers than the supported roles", () => {
    const source = readFileSync(resolve("src/lib/esign/lor-letter.ts"), "utf8");
    const signerRead = source.slice(
      source.indexOf('const { data: claimants } = await admin'),
      source.indexOf('if (!claimants || claimants.length === 0)'),
    );

    expect(signerRead).toContain('.order("is_primary", { ascending: false })');
    expect(signerRead).toContain('.order("created_at", { ascending: true })');
    expect(signerRead).toContain('.order("id", { ascending: true })');
    expect(signerRead).toContain(".limit(ROLES.length)");
  });
});
