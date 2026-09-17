import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract this pins: **each of the homeowner's four writes checks its
 * gates in a fixed order, echoes what was typed on every refusal that has
 * something to echo, and maps a zero-row RLS refusal to the one generic
 * sentence spec §7.9 asks for rather than a database detail.**
 *
 * `askQuestion` is rate limit, then schema, then "is this claim yours" —
 * getting that order wrong either spends a validation pass on a submission
 * that was always going to be refused, or (worse) lets a malformed body reach
 * the ownership check and leak which uuids exist. `withdrawConsent`'s
 * `is null` predicate is what makes a second click harmless rather than a
 * false "withdrawn again" audit entry with a later timestamp.
 *
 * The stubs stop at the module boundary. `requireRole("customer")` and the
 * table policies it stands in front of — `claim_events_insert_customer`,
 * `profiles_update_self`, `consents_update`, `guard_consent_immutable()` — are
 * the real gates and are covered in the pgTAP suite.
 */

const stub = vi.hoisted(() => {
  const USER_ID = "0e37b7c6-1c1a-4a3e-9f21-0d2c6b7e4a11";
  const CLAIM_ID = "20000000-0000-4000-a000-000000000001";
  const CONSENT_ID = "30000000-0000-4000-a000-000000000001";

  return {
    USER_ID,
    CLAIM_ID,
    CONSENT_ID,
    session: { userId: USER_ID, email: "dana@example.test", aal: "aal1", role: "customer" as const },

    allowRate: true,
    claimRow: { id: CLAIM_ID } as { id: string } | null,

    inserted: vi.fn(),
    insertResult: {
      data: [{ id: "event-1" }] as Array<{ id: string }> | null,
      error: null as { message: string } | null,
    },

    updated: vi.fn(),
    updateResult: {
      data: [{ id: USER_ID }] as Array<{ id: string }> | null,
      error: null as { message: string } | null,
    },

    consentUpdated: vi.fn(),
    consentResult: {
      data: [{ id: "30000000-0000-4000-a000-000000000001", kind: "email" }] as
        | Array<{ id: string; kind: string }>
        | null,
      error: null as { message: string } | null,
    },

    notifyWarning: null as string | null,
    audited: vi.fn(),

    signInResult: {
      data: { user: { id: USER_ID } as { id: string } | null },
      error: null as { message: string } | null,
    },
    signOut: vi.fn(async () => ({ error: null })),
    leaked: false,
    updateUserError: null as { message: string } | null,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

vi.mock("@/lib/authz", () => ({
  requireRole: vi.fn(async () => stub.session),
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn(async (_admin: unknown, entry: unknown) => {
    stub.audited(entry);
  }),
}));

vi.mock("@/lib/auth/leaked-password", () => ({
  isLeakedPassword: vi.fn(async () => stub.leaked),
}));

vi.mock("@/lib/claims/notify", () => ({
  notifyStaffOfQuestion: vi.fn(async () => stub.notifyWarning),
}));

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    portalQuestionUser: { scope: "portal-question:user", max: 10, window: "1 hour" },
    portalPasswordUser: { scope: "portal-password:user", max: 5, window: "1 hour" },
  },
  checkRateLimit: vi.fn(async () => stub.allowRate),
  clientIpFromHeaders: vi.fn(() => "203.0.113.5"),
  inetOrNull: vi.fn((value: string) => value),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      updateUser: vi.fn(async () => ({ error: stub.updateUserError })),
    },
    from: (table: string) => {
      if (table === "claims") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: stub.claimRow, error: null }) }),
          }),
        };
      }
      if (table === "claim_events") {
        return {
          insert: (rows: unknown) => {
            stub.inserted(rows);
            return { select: async () => stub.insertResult };
          },
        };
      }
      if (table === "profiles") {
        return {
          update: (patch: unknown) => {
            stub.updated(patch);
            return {
              eq: () => ({ select: async () => stub.updateResult }),
            };
          },
        };
      }
      if (table === "consents") {
        return {
          update: (patch: unknown) => {
            stub.consentUpdated(patch);
            return {
              eq: () => ({
                is: () => ({ select: async () => stub.consentResult }),
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(async () => stub.signInResult),
      signOut: stub.signOut,
    },
  })),
}));

const { askQuestion, updateProfile, changePassword, withdrawConsent } = await import("./portal");
const { idleState } = await import("./types");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.allowRate = true;
  stub.claimRow = { id: stub.CLAIM_ID };
  stub.insertResult = { data: [{ id: "event-1" }], error: null };
  stub.updateResult = { data: [{ id: stub.USER_ID }], error: null };
  stub.consentResult = { data: [{ id: stub.CONSENT_ID, kind: "email" }], error: null };
  stub.notifyWarning = null;
  stub.signInResult = { data: { user: { id: stub.USER_ID } }, error: null };
  stub.leaked = false;
  stub.updateUserError = null;
});

describe("askQuestion — gate order: rate limit, then schema, then ownership", () => {
  it("refuses over the rate limit before touching the schema or the claim", async () => {
    stub.allowRate = false;

    const state = await askQuestion(idleState, form({ claimId: stub.CLAIM_ID, body: "" }));

    expect(state.status).toBe("error");
    expect(state.values?.body).toBe("");
    expect(stub.inserted).not.toHaveBeenCalled();
  });

  it("refuses a blank question under the rate limit, and echoes it", async () => {
    const state = await askQuestion(
      idleState,
      form({ claimId: stub.CLAIM_ID, body: "   " }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.body).toBeDefined();
    expect(state.values?.body).toBe("   ");
    expect(stub.inserted).not.toHaveBeenCalled();
  });

  it("refuses a claim that is not the caller's, after validation passes", async () => {
    stub.claimRow = null;

    const state = await askQuestion(
      idleState,
      form({ claimId: stub.CLAIM_ID, body: "Is my roof covered?" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toContain("could not find that claim");
    expect(state.values?.body).toBe("Is my roof covered?");
    expect(stub.inserted).not.toHaveBeenCalled();
  });

  it("posts the question and appends the best-effort staff-alert warning", async () => {
    stub.notifyWarning = "Your question was posted, but the alert to CMG could not be queued.";

    const state = await askQuestion(
      idleState,
      form({ claimId: stub.CLAIM_ID, body: "Is my roof covered?" }),
    );

    expect(state.status).toBe("success");
    expect(state.message).toContain("Sent, and it is on your claim.");
    expect(state.message).toContain(stub.notifyWarning);
  });

  it("maps zero affected rows to the generic 'nothing changed' refusal", async () => {
    stub.insertResult = { data: [], error: null };

    const state = await askQuestion(
      idleState,
      form({ claimId: stub.CLAIM_ID, body: "Is my roof covered?" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/Nothing has changed/);
  });
});

describe("updateProfile", () => {
  it("echoes all three fields when the phone is refused", async () => {
    const state = await updateProfile(
      idleState,
      form({ firstName: "Dana", lastName: "Whitfield", phone: "123" }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.phone).toBeDefined();
    expect(state.values).toEqual({ firstName: "Dana", lastName: "Whitfield", phone: "123" });
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("saves the three columns scoped to the caller's own id", async () => {
    const state = await updateProfile(
      idleState,
      form({ firstName: "Dana", lastName: "Whitfield", phone: "407-555-0119" }),
    );

    expect(state.status).toBe("success");
    expect(stub.updated).toHaveBeenCalledWith({
      first_name: "Dana",
      last_name: "Whitfield",
      phone: "407-555-0119",
    });
  });

  it("maps a zero-row RLS refusal to the generic message rather than a database detail", async () => {
    stub.updateResult = { data: [], error: null };

    const state = await updateProfile(
      idleState,
      form({ firstName: "Dana", lastName: "Whitfield", phone: "" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/Nothing has changed/);
  });

  it("reports the generic error, without a database detail, on an update failure", async () => {
    stub.updateResult = { data: null, error: { message: "connection reset" } };

    const state = await updateProfile(
      idleState,
      form({ firstName: "Dana", lastName: "Whitfield", phone: "" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).not.toContain("connection reset");
  });
});

describe("changePassword — order: rate limit, then schema, then current-password check", () => {
  function validForm(overrides: Record<string, string> = {}) {
    return form({
      currentPassword: "OldPassword-9!x",
      newPassword: "Xk9#mQ7!vBz2",
      confirmPassword: "Xk9#mQ7!vBz2",
      ...overrides,
    });
  }

  it("refuses over the rate limit before checking the current password", async () => {
    stub.allowRate = false;

    const state = await changePassword(idleState, validForm());

    expect(state.status).toBe("error");
    expect(stub.signOut).not.toHaveBeenCalled();
  });

  it("refuses a new password that fails the schema before any credential check", async () => {
    const state = await changePassword(idleState, validForm({ newPassword: "short", confirmPassword: "short" }));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.newPassword).toBeDefined();
    expect(stub.signOut).not.toHaveBeenCalled();
  });

  it("audits and refuses a wrong current password, without echoing any secret", async () => {
    stub.signInResult = { data: { user: null }, error: { message: "invalid credentials" } };

    const state = await changePassword(idleState, validForm());

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.currentPassword).toBe("That is not your current password.");
    expect(state.values).toBeUndefined();
    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.password_change_refused",
        meta: { reason: "current_password_wrong" },
      }),
    );
  });

  it("refuses a leaked new password without writing anything", async () => {
    stub.leaked = true;

    const state = await changePassword(idleState, validForm());

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.newPassword).toMatch(/known data breach/);
    expect(stub.audited).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.password_changed" }),
    );
  });

  it("changes the password and audits the success, with no values to echo", async () => {
    const state = await changePassword(idleState, validForm());

    expect(state.status).toBe("success");
    expect(state.values).toBeUndefined();
    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.password_changed", meta: { surface: "portal" } }),
    );
  });
});

describe("withdrawConsent — idempotent on `withdrawn_at is null`", () => {
  it("refuses a malformed consent id without reaching the database", async () => {
    const state = await withdrawConsent(idleState, form({ consentId: "not-a-uuid" }));

    expect(state.status).toBe("error");
    expect(stub.consentUpdated).not.toHaveBeenCalled();
  });

  it("stamps withdrawn_at only, and answers with the SMS-specific sentence for that kind", async () => {
    stub.consentResult = { data: [{ id: stub.CONSENT_ID, kind: "sms" }], error: null };

    const state = await withdrawConsent(idleState, form({ consentId: stub.CONSENT_ID }));

    expect(state.status).toBe("success");
    expect(stub.consentUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ withdrawn_at: expect.any(String) }),
    );
    expect(Object.keys(stub.consentUpdated.mock.calls[0][0])).toEqual(["withdrawn_at"]);
    expect(state.message).toMatch(/not text you/);
  });

  it("reports the already-withdrawn refusal on a second click — the is-null predicate matched nothing", async () => {
    stub.consentResult = { data: [], error: null };

    const state = await withdrawConsent(idleState, form({ consentId: stub.CONSENT_ID }));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/already withdrawn/);
  });

  it("writes no audit row — the trigger on consents already carries the trail", async () => {
    await withdrawConsent(idleState, form({ consentId: stub.CONSENT_ID }));

    expect(stub.audited).not.toHaveBeenCalled();
  });
});
