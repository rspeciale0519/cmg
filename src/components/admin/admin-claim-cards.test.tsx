import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminClaimCards } from "./admin-claim-cards";

vi.mock("server-only", () => ({}));

const claim = {
  adjuster_name: "Alex Morgan",
  assigned_adjuster_id: "adjuster-1",
  claim_ref: "CMG-2026-0042",
  id: "claim-42",
  intake_referral_partner_id: null,
  intake_referral_partner_name: null,
  loss_date: "2026-08-01",
  partner_company_id: null,
  partner_name: null,
  property_city: "Orlando",
  property_state: "FL",
  property_street: "125 Long Property Name Avenue",
  property_zip: "32801",
  search_text: "",
  status: "filed" as const,
  updated_at: new Date().toISOString(),
};

describe("AdminClaimCards", () => {
  it("renders the essential claim facts through intermediate widths", () => {
    const markup = renderToStaticMarkup(
      <AdminClaimCards
        claims={[claim]}
        claimants={new Map([
          [
            claim.id,
            [
              {
                first_name: "Jordan",
                last_name: "Taylor",
                is_primary: true,
              },
            ],
          ],
        ])}
        sortLabel="last updated"
      />,
    );

    expect(markup).toContain('<ul aria-label="Claims, sorted by last updated"');
    expect(markup).toContain("xl:hidden");
    expect(markup).toContain("md:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]");
    expect(markup).toContain('href="/admin/claims/claim-42"');
    expect(markup).toContain("CMG-2026-0042");
    expect(markup).toContain("Jordan Taylor");
    expect(markup).toContain("125 Long Property Name Avenue, Orlando, FL 32801");
    expect(markup).toContain("Filed");
    expect(markup).toContain("Alex Morgan");
    expect(markup).toContain("Updated");
    expect(markup).toContain(`<time dateTime="${claim.updated_at}">`);
  });

  it("falls back safely when a claim has no homeowner or adjuster", () => {
    const markup = renderToStaticMarkup(
      <AdminClaimCards
        claims={[{ ...claim, adjuster_name: null }]}
        claimants={new Map()}
        sortLabel="reference"
      />,
    );

    expect(markup).toContain("Unassigned");
    expect(markup).toContain("—");
  });
});
