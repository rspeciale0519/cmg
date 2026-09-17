// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The authorization and refusal half of the prefilled letter.
 *
 * Every refusal is asserted twice: the answer the caller gets, *and* that no
 * PDF was built. Only the second is the security property — a refusal returned
 * alongside a finished Letter of Representation is not a refusal. The audit row
 * gets the same treatment in reverse: the bytes are only handed over once it is
 * written, because it is the sole record that a completed agreement carrying a
 * homeowner's terms left the system.
 */

const CLAIM_ID = "11111111-2222-4333-8444-555555555555";
const OWNER_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ADJUSTER_ID = "99999999-8888-4777-8666-555555555555";

type Row = Record<string, unknown> | null;

const state = vi.hoisted(() => ({
  visible: null as Row,
  claim: null as Row,
  claimants: [] as Row[],
  financials: null as Row,
  adjuster: null as Row,
  auditFails: false,
  buildThrows: false,
}));

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  audited: vi.fn(),
  build: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/authz", () => ({
  requireStaff: (...args: unknown[]) => mocks.requireStaff(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  clientIpFromHeaders: vi.fn(() => "203.0.113.29"),
  inetOrNull: vi.fn((value: string) => value),
}));
vi.mock("@/lib/audit", () => ({
  writeAuditStrict: vi.fn(async (_admin: unknown, event: unknown) => {
    mocks.audited(event);
    if (state.auditFails) throw new Error("audit unavailable");
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: state.visible, error: null }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminStub() }));
vi.mock("./lor-prefill", async () => {
  const actual =
    await vi.importActual<typeof import("./lor-prefill")>("./lor-prefill");
  return {
    ...actual,
    buildPrefilledLorPdf: (...args: unknown[]) => {
      mocks.build(...args);
      if (state.buildThrows) throw new Error("pdf-lib exploded");
      return Promise.resolve(new TextEncoder().encode("%PDF-1.7 prefilled"));
    },
  };
});

/**
 * A service-role client just wide enough for the reads `collectLorLetter` and
 * `loadLorClaim` make, answering per table so each gate can be starved of
 * exactly one thing.
 */
function adminStub() {
  const single = (data: Row) => ({ maybeSingle: async () => ({ data, error: null }) });
  const list = (data: Row[]) => {
    const chain = {
      order: () => chain,
      limit: async () => ({ data, error: null }),
    };
    return chain;
  };

  return {
    from(table: string) {
      if (table === "claimants") {
        return { select: () => ({ eq: () => list(state.claimants) }) };
      }
      const row =
        table === "claims"
          ? state.claim
          : table === "claim_financials"
            ? state.financials
            : state.adjuster;
      return { select: () => ({ eq: () => single(row) }) };
    },
  };
}

const { prefillLorForClaim } = await import("./prefill-lor");

function signedInAs(role: string, userId: string) {
  mocks.requireStaff.mockResolvedValue({ userId, role, aal: "aal2", email: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.auditFails = false;
  state.buildThrows = false;
  state.visible = { id: CLAIM_ID, assigned_adjuster_id: ADJUSTER_ID };
  state.claim = {
    id: CLAIM_ID,
    claim_ref: "CMG-2026-0042",
    status: "under_review",
    carrier: "Citizens",
    policy_number: "POL-42",
    claim_number: "CLM-7",
    lor_contract_type: "emergency",
    loss_date: "2026-07-04",
    cause: "hurricane",
    property_street: "1 Test Way",
    property_street2: null,
    property_city: "Orlando",
    property_state: "Florida",
    property_zip: "32801",
    assigned_adjuster_id: ADJUSTER_ID,
    requested_adjuster: null,
    pandadoc_document_id: null,
    esign_status: null,
  };
  state.claimants = [
    {
      first_name: "Dana",
      last_name: "Roe",
      email: "dana@example.com",
      phone: "(727) 555-0134",
      is_primary: true,
      created_at: "2026-07-05T00:00:00Z",
    },
  ];
  state.financials = { fee_percent: 12.5 };
  state.adjuster = { first_name: "Sam", last_name: "Vale" };
  signedInAs("adjuster", ADJUSTER_ID);
});

describe("prefilled LOR authorization", () => {
  it.each([
    ["an assistant, who holds no authority over the lifecycle", "assistant", OWNER_ID],
    ["an adjuster the claim is not assigned to", "adjuster", OWNER_ID],
  ])("refuses %s", async (_case, role, userId) => {
    signedInAs(role, userId);

    await expect(prefillLorForClaim(CLAIM_ID)).resolves.toMatchObject({
      ok: false,
      code: "not_authorized",
    });
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.audited).not.toHaveBeenCalled();
  });

  it("refuses a claim RLS did not return", async () => {
    state.visible = null;

    await expect(prefillLorForClaim(CLAIM_ID)).resolves.toMatchObject({
      ok: false,
      code: "not_authorized",
    });
    expect(mocks.build).not.toHaveBeenCalled();
  });

  it("refuses a malformed id before it reaches Postgres as a cast error", async () => {
    signedInAs("owner", OWNER_ID);

    await expect(prefillLorForClaim("not-a-uuid")).resolves.toMatchObject({
      ok: false,
      code: "not_authorized",
    });
    expect(mocks.build).not.toHaveBeenCalled();
  });

  it("gives every refusal one message, so it measures nothing", async () => {
    signedInAs("assistant", OWNER_ID);
    const refused = await prefillLorForClaim(CLAIM_ID);
    state.visible = null;
    signedInAs("owner", OWNER_ID);
    const missing = await prefillLorForClaim(CLAIM_ID);

    expect(refused.ok).toBe(false);
    expect(missing.ok).toBe(false);
    expect(refused.ok === false && refused.message).toBe(
      missing.ok === false && missing.message,
    );
  });
});

describe("prefilled LOR content gates", () => {
  it.each([
    ["no carrier", "missing_policy", () => void (state.claim!.carrier = null)],
    ["no policy number", "missing_policy", () => void (state.claim!.policy_number = null)],
    [
      "no agreement type",
      "missing_lor_type",
      () => void (state.claim!.lor_contract_type = null),
    ],
    ["no claimants", "no_claimants", () => void (state.claimants = [])],
    ["no saved fee", "missing_fee", () => void (state.financials = null)],
  ])("refuses a claim with %s", async (_case, code, starve) => {
    starve();

    await expect(prefillLorForClaim(CLAIM_ID)).resolves.toMatchObject({ ok: false, code });
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.audited).not.toHaveBeenCalled();
  });

  it("refuses a claim the service-role read cannot find", async () => {
    state.claim = null;

    await expect(prefillLorForClaim(CLAIM_ID)).resolves.toMatchObject({
      ok: false,
      code: "claim_not_found",
    });
    expect(mocks.build).not.toHaveBeenCalled();
  });
});

describe("prefilled LOR success", () => {
  it("returns the letter as an attachment and records who took it", async () => {
    const result = await prefillLorForClaim(CLAIM_ID, new Date("2026-08-14T16:00:00Z"));

    expect(result).toMatchObject({
      ok: true,
      claimRef: "CMG-2026-0042",
      filename: "LOR-CMG-2026-0042-prefilled.pdf",
      disposition: "attachment",
    });
    expect(result.ok === true && Buffer.from(result.pdfBase64, "base64").toString()).toBe(
      "%PDF-1.7 prefilled",
    );
    expect(mocks.audited).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "esign.lor_prefilled",
        entity: "claims",
        entityId: CLAIM_ID,
        actorId: ADJUSTER_ID,
      }),
    );
  });

  it("keeps signer contact details out of the audit trail", async () => {
    await prefillLorForClaim(CLAIM_ID);

    const event = mocks.audited.mock.calls[0][0];
    expect(JSON.stringify(event)).not.toContain("dana@example.com");
    expect(JSON.stringify(event)).not.toContain("555-0134");
    expect(event.meta).toMatchObject({ signer_count: 1, fee_percent: 12.5 });
  });

  it("withholds the letter when its required audit fails", async () => {
    state.auditFails = true;

    const result = await prefillLorForClaim(CLAIM_ID);

    expect(result).toMatchObject({ ok: false, code: "generate_failed" });
    expect(JSON.stringify(result)).not.toContain("prefilled");
  });

  it("refuses rather than throwing when the letter cannot be built", async () => {
    state.buildThrows = true;

    await expect(prefillLorForClaim(CLAIM_ID)).resolves.toMatchObject({
      ok: false,
      code: "generate_failed",
    });
    expect(mocks.audited).not.toHaveBeenCalled();
  });
});
