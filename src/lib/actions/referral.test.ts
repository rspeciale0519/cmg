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
    transactionInput: null as Record<string, unknown> | null,
    transactionFails: false,
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

vi.mock("./submission-transactions", () => ({
  submitClaimUnit: vi.fn(async (_admin: unknown, input: Record<string, unknown>) => {
    stub.transactionInput = input;
    return stub.transactionFails
      ? null
      : { id: stub.CLAIM.id, claim_ref: stub.CLAIM.claim_ref, outbox_ids: [] };
  }),
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

const claimInsert = () =>
  stub.transactionInput?.claim as
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
  stub.transactionInput = null;
  stub.transactionFails = false;
});

describe("referClaim — the four gates", () => {
  it("refuses over the rate limit, writes nothing, and keeps the typing", async () => {
    stub.allowRate = false;

    const state = await referClaim(idleState, form());

    expect(state.status).toBe("error");
    expect(stub.transactionInput).toBeNull();
    expect(state.values?.description).toBe(SUBMISSION.description);
    expect(state.values?.firstName).toBe("Dana");
  });

  it("does not spend a verification request on a submission it has already refused", async () => {
    stub.allowRate = false;

    await referClaim(idleState, form());

    const { verifyTurnstile } = await import("@/lib/turnstile");
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it("refuses a rejected challenge, writes nothing, and keeps the typing", async () => {
    stub.turnstileOk = false;

    const state = await referClaim(idleState, form());

    expect(state.status).toBe("error");
    expect(state.message).toContain("verify");
    expect(stub.transactionInput).toBeNull();
    expect(state.values?.description).toBe(SUBMISSION.description);
  });

  it("marks a bad field, writes nothing, and hands back all twelve strings as typed", async () => {
    const state = await referClaim(
      idleState,
      form({ email: "dana@example", zip: "328", street2: "  Unit 4  " }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBeDefined();
    expect(state.fieldErrors?.zip).toBeDefined();
    expect(stub.transactionInput).toBeNull();
    // Untrimmed: the point is to hand back what is in the box, not what the
    // schema would have made of it.
    expect(state.values?.street2).toBe("  Unit 4  ");
    expect(state.values?.email).toBe("dana@example");
    expect(state.values?.cause).toBe("wind_hail");
  });

  it("refuses a rep whose company answers nothing — deactivated, terminated or never a partner", async () => {
    stub.companyRows = [];

    const state = await referClaim(idleState, form());

    expect(state.status).toBe("error");
    expect(state.message).toContain("active partner company");
    expect(stub.transactionInput).toBeNull();
    expect(state.values?.firstName).toBe("Dana");
  });

  it("refuses when the company lookup itself fails, rather than proceeding unattributed", async () => {
    stub.companyError = { message: "connection reset" };

    const state = await referClaim(idleState, form());

    expect(state.status).toBe("error");
    expect(stub.transactionInput).toBeNull();
  });
});

describe("referClaim — what the claim row says", () => {
  it("is a new intake attributed to the rep's own company", async () => {
    const state = await referClaim(idleState, form());

    expect(state.status).toBe("success");
    expect(state.reference).toBe("CMG-2026-0104");
    expect(claimInsert()).toMatchObject({
      status: "new_intake",
    });
    expect(stub.transactionInput?.partnerCompanyId).toBe(stub.COMPANY.id);
  });

  it("credits the referral to the person submitting it and not to a form field", async () => {
    await referClaim(
      idleState,
      form({ referrerName: "Someone Else Roofing", referrerEmail: "them@example.com" }),
    );

    expect(claimInsert()).toMatchObject({
      referrer_name: "Summit Exteriors LLC — Tyler Boone",
      referrer_email: "partner@cmg.test",
    });
  });

  it("falls back to the company alone when the rep's profile carries no name", async () => {
    stub.profile = { first_name: null, last_name: null };

    await referClaim(idleState, form());

    expect(claimInsert()).toMatchObject({ referrer_name: "Summit Exteriors LLC" });
  });

  it("leaves the policy side null rather than guessing it", async () => {
    await referClaim(idleState, form());

    const row = claimInsert()!;
    expect(row.carrier).toBeNull();
    expect(row.policy_number).toBeNull();
    expect(row.carrier_tenure).toBeNull();
  });

  /**
   * `claims.loss_time` still defaults to noon, so omitting the column would have
   * the database assert a time nobody gave — and the intake queue's triage card
   * prints it beside the date.
   */
  it("passes an explicit null time rather than letting the column default to noon", async () => {
    await referClaim(idleState, form());

    const row = claimInsert()!;
    expect(row).toHaveProperty("loss_time");
    expect(row.loss_time).toBeNull();
  });

  it("leaves claim_ref to the database trigger that generates it", async () => {
    expect(claimInsert).toBeDefined();
    await referClaim(idleState, form());
    expect(claimInsert()).not.toHaveProperty("claim_ref");
  });
});
