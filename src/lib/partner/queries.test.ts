import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ notFound: stub.notFound }));
vi.mock("@/lib/authz", () => ({ requireRole: stub.requireRole }));
vi.mock("@/lib/supabase/server", () => ({ createClient: stub.createClient }));

const { loadPartnerClaim, requirePartnerClaim } = await import("./queries");

const claimId = "20000000-0000-4000-a000-000000000001";
const summary = { claim_id: claimId, claim_ref: "CMG-2026-0005" };

function mockQuery(result: { data: unknown; error?: { message: string } | null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ error: null, ...result });
  const from = vi.fn(() => query);
  stub.createClient.mockResolvedValue({ from });
  return { from, query };
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.requireRole.mockResolvedValue({ role: "partner" });
});

describe("partner claim reads", () => {
  it("checks the partner role before rejecting an invalid UUID without querying", async () => {
    await expect(loadPartnerClaim("not-a-uuid")).resolves.toBeNull();

    expect(stub.requireRole).toHaveBeenCalledWith("partner");
    expect(stub.createClient).not.toHaveBeenCalled();
    expect(stub.notFound).not.toHaveBeenCalled();
  });

  it("returns no row for a claim outside the caller's partner projection", async () => {
    const { from, query } = mockQuery({ data: null });

    await expect(loadPartnerClaim(claimId)).resolves.toBeNull();

    expect(stub.requireRole).toHaveBeenCalledWith("partner");
    expect(from).toHaveBeenCalledWith("claim_partner_summaries");
    expect(query.select).toHaveBeenCalledWith(
      "claim_id, claim_ref, homeowner_name, property_street, property_city, status, lor_signed_at, filed_at, settled_at, settlement_amount, updated_at",
    );
    expect(query.eq).toHaveBeenCalledWith("claim_id", claimId);
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it("keeps query errors as errors", async () => {
    const failure = { message: "database unavailable" };
    mockQuery({ data: null, error: failure });

    await expect(loadPartnerClaim(claimId)).rejects.toThrow(
      "Partner claim could not be loaded: database unavailable",
    );
  });

  it("keeps notFound in the rendered-consumer wrapper", async () => {
    mockQuery({ data: null });

    await expect(requirePartnerClaim(claimId)).rejects.toThrow("not-found");
    expect(stub.notFound).toHaveBeenCalledOnce();
  });

  it("returns visible claims through the rendered-consumer wrapper", async () => {
    mockQuery({ data: summary });

    await expect(requirePartnerClaim(claimId)).resolves.toMatchObject(summary);
    expect(stub.notFound).not.toHaveBeenCalled();
  });

  it("does not turn a partner-role refusal into a nullable result", async () => {
    const refusal = new Error("not-found");
    stub.requireRole.mockRejectedValue(refusal);

    await expect(loadPartnerClaim("not-a-uuid")).rejects.toBe(refusal);
    expect(stub.createClient).not.toHaveBeenCalled();
  });
});
