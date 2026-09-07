import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  claimNamesAPolicy,
  hasSignedLor,
  isLegalTransition,
  legalTransitions,
  namesAPolicy,
  transitionBlocks,
} = await import("./transitions");

type RpcResult = { data: unknown; error: { message: string } | null };

function clientWithRpc(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result);
  // Only the two members the module touches. A fuller fake would be a second
  // implementation of supabase-js and would start to pass tests the real client
  // would fail.
  return { client: { rpc } as never, rpc };
}

function clientWithDocuments(result: {
  data: { id: string }[] | null;
  error: { message: string } | null;
}) {
  const limit = vi.fn().mockResolvedValue(result);
  const eqKind = vi.fn().mockReturnValue({ limit });
  const eqClaim = vi.fn().mockReturnValue({ eq: eqKind });
  const select = vi.fn().mockReturnValue({ eq: eqClaim });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as never, from, select, eqClaim, eqKind };
}

function clientWithClaim(result: {
  data: { carrier: string | null; policy_number: string | null } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from } as never, from, select, eq };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("legalTransitions", () => {
  it("asks the database rather than a local map", async () => {
    const { client, rpc } = clientWithRpc({
      data: ["negotiating", "denied"],
      error: null,
    });

    const result = await legalTransitions(client, "filed");

    expect(rpc).toHaveBeenCalledWith("allowed_claim_transitions", {
      p_from: "filed",
    });
    expect(result).toEqual(["negotiating", "denied"]);
  });

  it("fails closed when the RPC errors", async () => {
    // No moves at all is the safe direction for a control whose entire job is
    // to constrain what may happen to a claim. Returning a guessed set here
    // would offer transitions the trigger will refuse.
    const { client } = clientWithRpc({ data: null, error: { message: "boom" } });
    expect(await legalTransitions(client, "filed")).toEqual([]);
  });

  it("drops any value that is not a claim status", async () => {
    const { client } = clientWithRpc({
      data: ["negotiating", "not_a_status", null],
      error: null,
    });
    expect(await legalTransitions(client, "filed")).toEqual(["negotiating"]);
  });

  it("treats a null array as no moves", async () => {
    const { client } = clientWithRpc({ data: null, error: null });
    expect(await legalTransitions(client, "closed")).toEqual([]);
  });
});

describe("isLegalTransition", () => {
  it("accepts a move the database returned", async () => {
    const { client } = clientWithRpc({ data: ["under_review", "rejected"], error: null });
    expect(await isLegalTransition(client, "new_intake", "under_review")).toBe(true);
  });

  it("refuses a move the database did not return", async () => {
    const { client } = clientWithRpc({ data: ["under_review", "rejected"], error: null });
    expect(await isLegalTransition(client, "new_intake", "settled")).toBe(false);
  });

  it("refuses everything when the RPC is unavailable", async () => {
    const { client } = clientWithRpc({ data: null, error: { message: "down" } });
    expect(await isLegalTransition(client, "new_intake", "under_review")).toBe(false);
  });
});

describe("hasSignedLor", () => {
  it("queries documents for the lor_signed kind on that claim", async () => {
    const { client, from, eqClaim, eqKind } = clientWithDocuments({
      data: [{ id: "doc-1" }],
      error: null,
    });

    expect(await hasSignedLor(client, "claim-1")).toBe(true);
    expect(from).toHaveBeenCalledWith("documents");
    expect(eqClaim).toHaveBeenCalledWith("claim_id", "claim-1");
    expect(eqKind).toHaveBeenCalledWith("kind", "lor_signed");
  });

  it("is false when the claim holds no signed letter", async () => {
    const { client } = clientWithDocuments({ data: [], error: null });
    expect(await hasSignedLor(client, "claim-1")).toBe(false);
  });

  it("is false when the read fails", async () => {
    const { client } = clientWithDocuments({ data: null, error: { message: "nope" } });
    expect(await hasSignedLor(client, "claim-1")).toBe(false);
  });
});

describe("namesAPolicy", () => {
  it("is true only when the claim carries both columns", () => {
    expect(namesAPolicy({ carrier: "Citizens", policy_number: "FL-1" })).toBe(true);
  });

  it("is false for a partner referral, which carries neither", () => {
    expect(namesAPolicy({ carrier: null, policy_number: null })).toBe(false);
  });

  it("is false with a carrier and no policy number", () => {
    // Half the answer is still no: the letter cites a policy number, and one
    // sent without it names an insurer but not the contract it is about.
    expect(namesAPolicy({ carrier: "Citizens", policy_number: null })).toBe(false);
  });

  it("treats blank as absent, because no CHECK stops a column being whitespace", () => {
    expect(namesAPolicy({ carrier: "  ", policy_number: "FL-1" })).toBe(false);
    expect(namesAPolicy({ carrier: "Citizens", policy_number: "\t" })).toBe(false);
  });
});

describe("claimNamesAPolicy", () => {
  it("reads the two columns off the claim", async () => {
    const { client, from, eq } = clientWithClaim({
      data: { carrier: "Citizens", policy_number: "FL-1" },
      error: null,
    });

    expect(await claimNamesAPolicy(client, "claim-1")).toBe(true);
    expect(from).toHaveBeenCalledWith("claims");
    expect(eq).toHaveBeenCalledWith("id", "claim-1");
  });

  it("is false when the read fails", async () => {
    const { client } = clientWithClaim({ data: null, error: { message: "down" } });
    expect(await claimNamesAPolicy(client, "claim-1")).toBe(false);
  });

  it("is false for a claim the caller cannot see", async () => {
    // Zero rows is `claims_select` declining, and a claim this caller cannot
    // read is not one they can advance either.
    const { client } = clientWithClaim({ data: null, error: null });
    expect(await claimNamesAPolicy(client, "claim-1")).toBe(false);
  });
});

describe("transitionBlocks — the letter needs an addressee", () => {
  it("blocks lor_sent with a reason when the claim names no carrier", async () => {
    const { client } = clientWithClaim({
      data: { carrier: null, policy_number: null },
      error: null,
    });
    const blocks = await transitionBlocks(client, "claim-1", ["lor_sent", "rejected"]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].to).toBe("lor_sent");
    // The reason has to name the fix and where it is made — a disabled pill with
    // no sentence teaches an adjuster nothing about what to do next.
    expect(blocks[0].reason).toMatch(/Policy and carrier/);
  });

  it("does not block once both are on the file", async () => {
    const { client } = clientWithClaim({
      data: { carrier: "Citizens", policy_number: "FL-1" },
      error: null,
    });
    expect(await transitionBlocks(client, "claim-1", ["lor_sent", "rejected"])).toEqual([]);
  });

  it("does not query at all when lor_sent is not on offer", async () => {
    const { client, from } = clientWithClaim({ data: null, error: null });
    expect(await transitionBlocks(client, "claim-1", ["under_review", "rejected"])).toEqual(
      [],
    );
    expect(from).not.toHaveBeenCalled();
  });
});

describe("transitionBlocks — spec §5's document gate", () => {
  it("blocks lor_signed with a reason when no signed letter exists", async () => {
    const { client } = clientWithDocuments({ data: [], error: null });
    const blocks = await transitionBlocks(client, "claim-1", ["lor_signed", "rejected"]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].to).toBe("lor_signed");
    expect(blocks[0].reason).toMatch(/signed letter of representation/i);
  });

  it("does not block once the signed letter is on the file", async () => {
    const { client } = clientWithDocuments({ data: [{ id: "doc-1" }], error: null });
    expect(await transitionBlocks(client, "claim-1", ["lor_signed"])).toEqual([]);
  });

  it("does not query at all when lor_signed is not on offer", async () => {
    const { client, from } = clientWithDocuments({ data: [], error: null });
    expect(await transitionBlocks(client, "claim-1", ["negotiating", "denied"])).toEqual(
      [],
    );
    expect(from).not.toHaveBeenCalled();
  });
});
