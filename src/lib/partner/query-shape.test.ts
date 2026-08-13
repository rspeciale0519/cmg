import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("partner portal query boundaries", () => {
  it("loads claim UI only from the partner projection and applies a range", () => {
    const source = readFileSync(resolve("src/lib/partner/queries.ts"), "utf8");
    expect(source).toContain('.from("claim_partner_summaries")');
    expect(source).toContain(".range(from, to)");
    expect(source).not.toContain('.from("claims")');
    expect(source).not.toContain('.from("claimants")');
    expect(source).not.toContain('.from("documents")');
    expect(source).not.toContain('.from("claim_financials")');
  });

  it("lets caller RLS, not a client-side visibility copy, filter activity", () => {
    const source = readFileSync(
      resolve("src/app/(partner)/partner/claims/[id]/activity/page.tsx"),
      "utf8",
    );
    expect(source).toContain('.from("claim_events")');
    expect(source).toContain(".limit(PAGE_SIZE + 1)");
    expect(source).not.toContain('.eq("visibility"');
  });
});
