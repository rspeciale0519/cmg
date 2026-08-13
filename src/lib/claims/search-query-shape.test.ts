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

    expect(pageSource).toContain('.rpc("staff_claims_projection")');
    expect(pageSource).toContain('.rpc("staff_claims_projection", undefined, {');
    expect(pageSource).toContain('count: "exact"');
    expect(pageSource).toContain("head: true");
    expect(filterSource).toContain(
      '.ilike("search_text", `%${filters.search}%`)',
    );
    expect(pageSource).not.toContain('.from("claims")');
    expect(pageSource).not.toContain("profiles!claims_assigned_adjuster_id_fkey");
    expect(pageSource).not.toContain("partner_companies!claims_partner_company_id_fkey");
    expect(pageSource).not.toContain('.from("claimants")');
    expect(pageSource).not.toContain("claimantMatches");
  });
});
