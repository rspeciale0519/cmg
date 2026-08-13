import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contracts these pin, in the order a submission meets them:
 *
 *   * **Every refusal hands back what was typed.** Twelve fields, and React 19
 *     resets a form when its action *resolves* rather than when it succeeds — so
 *     a branch that forgets `values` empties the whole form under the message
 *     explaining what to fix. Four refusals reach the rep and all four are here.
 *   * **Nothing is written before all four gates pass.** Rate limit, challenge,
 *     schema, company — each one is asserted to have written no claim, because a
 *     gate that refuses *after* the insert is a gate that does not exist.
 *   * **A contractor cannot consent on the homeowner's behalf.** No `consents`
 *     row is written by this path, and that is a decision rather than an
 *     omission (see the note in `./referral`), so it is tested like one.
 *   * **A claim with no claimant is rolled back.** There is no client-side
 *     transaction, so the compensating delete is the only thing standing between
 *     a failed second statement and a file in the intake queue with nobody on it.
 *
 * The stubs stop at the module boundary. Nothing here reaches Postgres, so
 * nothing here is an authorization test — `requireRole("partner")` and
 * `public.partner_referral_company()` are the real gates and are covered in
 * `supabase/tests/15_partner_referral.test.sql`.
 */

const stub = vi.hoisted(() => {
  const PARTNER_ID = "00000000-0000-4000-a000-000000000005";
  const COMPANY = { id: "10000000-0000-4000-a000-000000000001", name: "Summit Exteriors LLC" };
  const CLAIM = { id: "20000000-0000-4000-a000-0000000000f1", claim_ref: "CMG-2026-0104" };

  return {
    PARTNER_ID,
    COMPANY,
    CLAIM,
    session: {
      userId: PARTNER_ID,
      email: "partner@cmg.test",
      aal: "aal1",
      role: "partner",
    },
    profile: { first_name: "Tyler", last_name: "Boone" } as {
      first_name: string | null;
      last_name: string | null;
    } | null,

    /* Knobs, reset in beforeEach. */
    allowRate: true,
    turnstileOk: true,
    companyRows: [COMPANY] as Array<{ id: string; name: string }>,
    companyError: null as { message: string } | null,
    claimError: null as { message: string } | null,
    claimantError: null as { message: string } | null,
    outboxError: null as { message: string } | null,

    /* Recorders. */
    inserted: vi.fn(),
    deleted: vi.fn(),
    audited: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn(async (_client: unknown, event: unknown) => {
    stub.audited(event);
  }),
}));

vi.mock("@/lib/authz", () => ({
  requireRole: vi.fn(async () => stub.session),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    partnerReferralUser: { scope: "partner-referral:user", max: 10, window: "1 hour" },
  },
  checkRateLimit: vi.fn(async () => stub.allowRate),
  clientIpFromHeaders: vi.fn(() => "203.0.113.9"),
  inetOrNull: vi.fn((value: string) => value),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: vi.fn(async () =>
    stub.turnstileOk ? { ok: true } : { ok: false, reason: "rejected" },
  ),
}));

/** The two writes, recorded rather than performed. */
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => ({
      insert: (rows: unknown) => {
        stub.inserted(table, rows);

        if (table === "claims") {
          return {
            select: () => ({
              single: async () =>
                stub.claimError
                  ? { data: null, error: stub.claimError }
                  : { data: stub.CLAIM, error: null },
            }),
          };
        }

        /* The staff alert. `enqueueNotifications` reads the ids back so it can
           attempt an immediate send, so the double has to return rows rather
           than a bare error — and with no RESEND_API_KEY that send is skipped,
           which is why nothing further is stubbed. */
        if (table === "notifications_outbox") {
          return {
            select: async () =>
              stub.outboxError
                ? { data: null, error: stub.outboxError }
                : { data: [{ id: "40000000-0000-4000-a000-000000000001" }], error: null },
          };
        }

        return Promise.resolve({ error: stub.claimantError });
      },
      delete: () => ({
        eq: async (column: string, value: string) => {
          stub.deleted(table, column, value);
          return { error: null };
        },
      }),
    }),
  })),
}));

/** The two reads, both under the caller's own session. */
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: async () => ({ data: stub.companyRows, error: stub.companyError }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: stub.profile, error: null }) }),
      }),
    }),
  })),
}));

import { referClaim } from "./referral";
import { idleState } from "./types";

const SUBMISSION = {
  firstName: "Dana",
  lastName: "Whitfield",
  email: "dana@example.com",
  phone: "407-555-0119",
  street: "1420 Palmetto Row",
  street2: "",
  city: "Orlando",
  state: "Florida",
  zip: "32801",
  lossDate: "2026-07-14",
  cause: "wind_hail",
  description: "South slope stripped, and the back bedroom ceiling is wet.",
  "cf-turnstile-response": "token-abc",
};

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...SUBMISSION, ...overrides })) {
    data.append(key, value);
  }
  return data;
}

const claimantInsert = () =>
  stub.inserted.mock.calls.find(([table]) => table === "claimants")?.[1] as
    | Record<string, unknown>
    | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  stub.allowRate = true;
  stub.turnstileOk = true;
  stub.companyRows = [stub.COMPANY];
  stub.companyError = null;
  stub.claimError = null;
  stub.claimantError = null;
  stub.outboxError = null;
  stub.profile = { first_name: "Tyler", last_name: "Boone" };
});

describe("referClaim — the homeowner", () => {
  it("is the primary claimant, with the contact details the rep gave", async () => {
    await referClaim(idleState, form());

    expect(claimantInsert()).toMatchObject({
      claim_id: stub.CLAIM.id,
      first_name: "Dana",
      last_name: "Whitfield",
      email: "dana@example.com",
      phone: "407-555-0119",
      is_primary: true,
    });
  });

  it("carries initials derived from the names, because the column is not nullable", async () => {
    await referClaim(idleState, form());

    expect(claimantInsert()!.initials).toBe("DW");
  });
});

/**
 * The decision, stated as a test: a contractor cannot agree, on somebody else's
 * behalf, to that person being texted. A consent row minted here would look
 * exactly like evidence while being evidence of nothing.
 */
describe("referClaim — consent", () => {
  it("writes no consent record for a homeowner who is not at the form", async () => {
    await referClaim(idleState, form());

    const tables = stub.inserted.mock.calls.map(([table]) => table);
    expect(tables).not.toContain("consents");
    /* Still exhaustive rather than a `toContain`, so a fourth write added later
       has to be justified here. `notifications_outbox` is the staff alert added
       in Phase 7 — it is addressed to CMG's own inbox, not to the homeowner, so
       it asserts nothing on their behalf. */
    expect(tables).toEqual(["claims", "claimants", "notifications_outbox"]);
  });
});

describe("referClaim — partial failure", () => {
  it("deletes the claim when the claimant cannot be written, so no file exists with nobody on it", async () => {
    stub.claimantError = { message: "duplicate key" };

    const state = await referClaim(idleState, form());

    expect(state.status).toBe("error");
    expect(stub.deleted).toHaveBeenCalledWith("claims", "id", stub.CLAIM.id);
    expect(state.values?.description).toBe(SUBMISSION.description);
  });

  it("refuses without a claimant write when the claim itself fails", async () => {
    stub.claimError = { message: "constraint" };

    const state = await referClaim(idleState, form());

    expect(state.status).toBe("error");
    expect(stub.inserted.mock.calls.map(([table]) => table)).toEqual(["claims"]);
    expect(stub.deleted).not.toHaveBeenCalled();
  });
});

describe("referClaim — the record", () => {
  it("audits the referral against the rep, naming the claim and the company", async () => {
    await referClaim(idleState, form());

    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: stub.PARTNER_ID,
        action: "claim.partner_referral",
        entity: "claims",
        entityId: stub.CLAIM.id,
        meta: expect.objectContaining({
          claim_ref: "CMG-2026-0104",
          partner_company_id: stub.COMPANY.id,
        }),
      }),
    );
  });

  it("echoes nothing on success, so the form empties for the next homeowner", async () => {
    const state = await referClaim(idleState, form());

    expect(state.status).toBe("success");
    expect(state.values).toBeUndefined();
  });

  /**
   * Before Phase 7 this action wrote a claim and told nobody. The referral's
   * entire arrival signal was a count on a queue somebody had to think to open,
   * while the contractor had already told the homeowner to expect a call.
   */
  it("alerts the CMG desk, because nothing else does", async () => {
    await referClaim(idleState, form());

    expect(stub.inserted).toHaveBeenCalledWith(
      "notifications_outbox",
      expect.arrayContaining([
        expect.objectContaining({ template: "referral_staff_alert" }),
      ]),
    );
  });

  /* The homeowner was not at this form and has consented to nothing, which is
     also why `referClaim` writes no `consents` row. CMG makes the first
     approach. */
  it("writes to nobody but the desk", async () => {
    await referClaim(idleState, form());

    const enqueued = stub.inserted.mock.calls.find(
      ([table]) => table === "notifications_outbox",
    );
    const rows = enqueued?.[1] as Array<{ recipient_email: string }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].recipient_email).not.toBe(SUBMISSION.email);
  });

  it("still reports the referral received when the alert cannot be queued", async () => {
    stub.outboxError = { message: "outbox unreachable" };

    const state = await referClaim(idleState, form());

    // The claim is committed by then. A rep must not be told their referral
    // failed because a mail queue was down — but they should be told to call.
    expect(state.status).toBe("success");
    expect(state.reference).toBe("CMG-2026-0104");
    expect(state.message).toMatch(/could not be queued/i);
    expect(stub.deleted).not.toHaveBeenCalled();
  });
});
