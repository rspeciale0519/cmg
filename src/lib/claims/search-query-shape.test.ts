import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin claims search query shape", () => {
  it("keeps claimant matching in PostgreSQL instead of expanding IDs into the URL", () => {
    const pageSource = readFileSync(
      resolve("src/app/(admin)/admin/claims/page.tsx"),
      "utf8",
    );
    const filterSource = readFileSync(resolve("src/lib/claims/search.ts"), "utf8");

    expect(pageSource).toContain("applyClaimFilters(");
    expect(filterSource).toContain(
      '.ilike("claim_search_text", `%${filters.search}%`)',
    );
    expect(pageSource).not.toContain('.from("claimants")');
    expect(pageSource).not.toContain("claimantMatches");
  });
});
