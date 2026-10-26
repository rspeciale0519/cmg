import { beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({
  loadPartnerClaim: vi.fn(),
  requirePartnerClaim: vi.fn(),
}));

vi.mock("@/lib/partner/queries", () => ({
  loadPartnerClaim: queries.loadPartnerClaim,
  requirePartnerClaim: queries.requirePartnerClaim,
}));
vi.mock("@/lib/authz", () => ({ NOT_FOUND_TITLE: "Page not found" }));
vi.mock("next/link", () => ({ default: vi.fn() }));
vi.mock("@/components/auth/portal-shell", () => ({ PortalShell: vi.fn() }));
vi.mock("@/components/partner/partner-nav", () => ({ PartnerNav: vi.fn() }));
vi.mock("@/components/portal/claim-tabs", () => ({ ClaimTabs: vi.fn() }));
vi.mock("@/lib/format", () => ({ humanizeEnum: vi.fn() }));
vi.mock("@/lib/portal/partner-identity", () => ({ partnerIdentity: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { generateMetadata } from "./layout";

const claimId = "20000000-0000-4000-a000-000000000001";
const summary = { claim_ref: "CMG-2026-0005" };

beforeEach(() => {
  vi.clearAllMocks();
  queries.requirePartnerClaim.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
});

describe("partner claim metadata", () => {
  it("uses the caller-visible claim reference", async () => {
    queries.loadPartnerClaim.mockResolvedValue(summary);

    await expect(generateMetadata({ params: Promise.resolve({ id: claimId }) })).resolves.toEqual({
      title: summary.claim_ref,
      robots: { index: false, follow: false },
    });
    expect(queries.loadPartnerClaim).toHaveBeenCalledWith(claimId);
    expect(queries.requirePartnerClaim).not.toHaveBeenCalled();
  });

  it.each([
    ["foreign", "20000000-0000-4000-a000-000000000002"],
    ["missing", "20000000-0000-4000-a000-000000000003"],
    ["malformed", "not-a-uuid"],
  ])("uses one generic title for a %s claim id", async (_kind, id) => {
    queries.loadPartnerClaim.mockResolvedValue(null);

    await expect(generateMetadata({ params: Promise.resolve({ id }) })).resolves.toEqual({
      title: "Page not found",
      robots: { index: false, follow: false },
    });
    expect(queries.loadPartnerClaim).toHaveBeenCalledWith(id);
    expect(queries.requirePartnerClaim).not.toHaveBeenCalled();
  });

  it("does not convert query or role failures into a generic title", async () => {
    const failure = new Error("query failed");
    queries.loadPartnerClaim.mockRejectedValue(failure);

    await expect(generateMetadata({ params: Promise.resolve({ id: claimId }) })).rejects.toBe(failure);
  });
});
