import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { hasSignedLor, isLegalTransition, legalTransitions, transitionBlocks } =
  await import("./transitions");

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
