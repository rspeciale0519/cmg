// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The authorization half of the LOR send. The mechanism it guards is exercised
 * against a real database in `lor-dispatch.test.ts`; what matters here is that
 * nothing reaches it without a staff session and the authority to manage the
 * claim in question.
 *
 * Every refusal is asserted twice: the result the caller gets, *and* that the
 * mechanism was never invoked. Only the second one is the security property —
 * a refusal returned after the letter has already gone out is not a refusal.
 */
const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  maybeSingle: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  requireStaff: (...args: unknown[]) => mocks.requireStaff(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => mocks.maybeSingle() }),
      }),
    }),
  }),
}));

vi.mock("./lor-dispatch", () => ({
  dispatchLorForClaim: (...args: unknown[]) => mocks.dispatch(...args),
}));

const { sendLor } = await import("./send-lor");

const CLAIM_ID = "11111111-2222-4333-8444-555555555555";
const OWNER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ADJUSTER_ID = "99999999-8888-4777-8666-555555555555";

function signedInAs(role: string, userId: string) {
  mocks.requireStaff.mockResolvedValue({ userId, role, aal: "aal2", email: null });
}

function claimAssignedTo(assignedAdjusterId: string | null) {
  mocks.maybeSingle.mockResolvedValue({
    data: { id: CLAIM_ID, assigned_adjuster_id: assignedAdjusterId },
    error: null,
  });
}

beforeEach(() => {
  mocks.requireStaff.mockReset();
  mocks.maybeSingle.mockReset();
  mocks.dispatch.mockReset();
  mocks.dispatch.mockResolvedValue({ ok: true });
});

describe("sendLor authorization", () => {
  it("refuses an assistant, who is staff but holds no authority over the lifecycle", async () => {
    signedInAs("assistant", OWNER_ID);
    claimAssignedTo(ADJUSTER_ID);

    await expect(sendLor({ claimId: CLAIM_ID })).resolves.toMatchObject({
      ok: false,
      code: "not_authorized",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("refuses an adjuster the claim is not assigned to", async () => {
    signedInAs("adjuster", ADJUSTER_ID);
    claimAssignedTo("00000000-0000-4000-8000-000000000000");

    await expect(sendLor({ claimId: CLAIM_ID })).resolves.toMatchObject({
      ok: false,
      code: "not_authorized",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("refuses an unassigned claim for an adjuster", async () => {
    signedInAs("adjuster", ADJUSTER_ID);
    claimAssignedTo(null);

    await expect(sendLor({ claimId: CLAIM_ID })).resolves.toMatchObject({
      ok: false,
      code: "not_authorized",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("refuses a claim RLS did not return, without reading an assignment", async () => {
    signedInAs("adjuster", ADJUSTER_ID);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(sendLor({ claimId: CLAIM_ID })).resolves.toMatchObject({
      ok: false,
      code: "not_authorized",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("refuses a malformed id before it reaches Postgres as a cast error", async () => {
    signedInAs("owner", OWNER_ID);

    await expect(sendLor({ claimId: "not-a-uuid" })).resolves.toMatchObject({
      ok: false,
      code: "not_authorized",
    });
    expect(mocks.maybeSingle).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("gives one message to all four refusals, so it measures nothing", async () => {
    const messages = new Set<string>();

    signedInAs("assistant", OWNER_ID);
    claimAssignedTo(ADJUSTER_ID);
    const assistant = await sendLor({ claimId: CLAIM_ID });

    signedInAs("adjuster", ADJUSTER_ID);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const invisible = await sendLor({ claimId: CLAIM_ID });

    signedInAs("owner", OWNER_ID);
    const malformed = await sendLor({ claimId: "nope" });

    for (const result of [assistant, invisible, malformed]) {
      if (result.ok) throw new Error("expected a refusal");
      messages.add(result.message);
    }

    expect(messages.size).toBe(1);
  });

  it("lets an owner through", async () => {
    signedInAs("owner", OWNER_ID);
    claimAssignedTo(ADJUSTER_ID);

    await sendLor({ claimId: CLAIM_ID });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it("lets the assigned adjuster through", async () => {
    signedInAs("adjuster", ADJUSTER_ID);
    claimAssignedTo(ADJUSTER_ID);

    await sendLor({ claimId: CLAIM_ID });
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });

  it("stamps the audit actor from the session, not from the caller", async () => {
    signedInAs("owner", OWNER_ID);
    claimAssignedTo(null);

    // A caller cannot name someone else as the actor: the field is not on
    // `SendLorRequest` at all, so smuggling it in takes a cast — and even then
    // the session's id is what is passed down.
    const smuggled = { claimId: CLAIM_ID, actorId: ADJUSTER_ID };
    await sendLor(smuggled as unknown as { claimId: string });

    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ claimId: CLAIM_ID, actorId: OWNER_ID }),
      expect.anything(),
    );
  });
});
