import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract these pin: **a refused server action hands back what was
 * submitted.**
 *
 * React 19 resets a `<form action={…}>` when the action *resolves*, so a
 * refusal emptied every uncontrolled field on the screen — on the partner edit
 * form it did worse than empty them, restoring the *stored* values so a flagged
 * Email field came back holding a valid address it had never been given.
 * `FormState.values` is what the forms re-seed from, which makes it load-bearing
 * rather than decorative: drop it from one refusal branch and that branch
 * silently discards a person's typing again, with nothing on screen to show for
 * it and no other test that would notice.
 *
 * The stubs below stop at the module boundary. Nothing here reaches Postgres,
 * so nothing here is an authorization test — `requireOwner` and `requireStaff`
 * are the real gates and have their own coverage in the pgTAP suite.
 */

const stub = vi.hoisted(() => {
  const OWNER_ID = "0e37b7c6-1c1a-4a3e-9f21-0d2c6b7e4a11";

  const claim = {
    id: "1f4b6b3e-6f52-4c4a-9a41-9c0f1d2e3a44",
    claim_ref: "CMG-2026-0104",
    status: "under_review",
    assigned_adjuster_id: OWNER_ID,
  };

  return {
    OWNER_ID,
    claim,
    session: { userId: OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/invites", () => ({ issueInvite: vi.fn(async () => ({ ok: true, url: "x" })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

vi.mock("@/lib/authz", () => ({
  requireOwner: vi.fn(async () => stub.session),
  requireStaff: vi.fn(async () => stub.session),
}));

/**
 * Only the read `loadClaimForWrite` makes. Every assertion below is on a
 * refusal that happens before any write, so a chain that answers one claim row
 * is the whole surface the actions need.
 */
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: stub.claim, error: null }),
        }),
      }),
    }),
  })),
}));

import { createPartnerCompany, updatePartnerCompany } from "./partners";
import { inviteStaff } from "./staff";
import { postClaimEvent, saveClaimFinancials } from "./claims";
import { idleInviteIssueState, idleState, submittedValues } from "./types";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const COMPANY = {
  name: "Gulf Coast Roofing",
  contactName: "Marguerite Devereaux",
  /* Passes Chrome's `type=email` check and fails zod's `optionalEmail`, which
     is exactly the submission that reached the server and came back to five
     empty boxes. */
  contactEmail: "marguerite@gulfcoast",
  contactPhone: "(850) 555-0142",
  notes: "Sends two or three roof claims a month out of Panama City.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPartnerCompany", () => {
  it("echoes all five submitted strings back when the email is refused", async () => {
    const state = await createPartnerCompany(idleState, form(COMPANY));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.contactEmail).toBe("Enter a valid email address.");
    expect(state.values).toEqual(COMPANY);
  });

  it("echoes the string as typed, not as the schema would have it", async () => {
    // Untrimmed, because the point is to hand back what is in the box so it can
    // be corrected — not to silently edit it under an error message.
    const state = await createPartnerCompany(
      idleState,
      form({ ...COMPANY, contactName: "  Marguerite  " }),
    );

    expect(state.values?.contactName).toBe("  Marguerite  ");
  });

  it("flags the empty name and still returns the other four fields", async () => {
    const state = await createPartnerCompany(idleState, form({ ...COMPANY, name: "" }));

    expect(state.fieldErrors?.name).toBe("Give the company a name.");
    expect(state.values?.contactName).toBe(COMPANY.contactName);
    expect(state.values?.notes).toBe(COMPANY.notes);
  });
});

describe("updatePartnerCompany", () => {
  const companyId = "6c1d9f0a-2b44-4b0e-8b8e-2f5a7c9d1e33";

  it("echoes the edited values rather than leaving the form to restore the stored ones", async () => {
    const state = await updatePartnerCompany(
      idleState,
      form({ ...COMPANY, companyId, notes: "Rewritten during this edit." }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.contactEmail).toBeDefined();
    expect(state.values?.notes).toBe("Rewritten during this edit.");
    expect(state.values?.contactEmail).toBe(COMPANY.contactEmail);
  });

  it("echoes even when the company id never named a company", async () => {
    const state = await updatePartnerCompany(
      idleState,
      form({ ...COMPANY, companyId: "not-a-uuid" }),
    );

    expect(state.status).toBe("error");
    expect(state.values).toEqual(COMPANY);
  });
});

describe("inviteStaff", () => {
  it("echoes the chosen role, which the select would otherwise snap back to adjuster", async () => {
    const state = await inviteStaff(
      idleInviteIssueState,
      form({ email: "sam@cmg", firstName: "Sam", role: "assistant" }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.email).toBeDefined();
    expect(state.values).toEqual({
      email: "sam@cmg",
      firstName: "Sam",
      role: "assistant",
    });
  });
});

describe("postClaimEvent", () => {
  it("marks the body and hands it back when there is nothing but whitespace in it", async () => {
    const state = await postClaimEvent(
      idleState,
      form({ claimId: stub.claim.id, body: "   \n  ", visibility: "internal" }),
    );

    expect(state.status).toBe("error");
    // The refusal is a fact about the textarea, so the textarea wears it.
    expect(state.fieldErrors?.body).toBe("Write something before posting.");
    expect(state.values?.body).toBe("   \n  ");
  });

  it("hands back an over-long entry rather than making it be retyped", async () => {
    const body = "a".repeat(4001);
    const state = await postClaimEvent(
      idleState,
      form({ claimId: stub.claim.id, body, visibility: "internal" }),
    );

    expect(state.fieldErrors?.body).toContain("4,000 characters");
    expect(state.values?.body).toBe(body);
  });
});

describe("saveClaimFinancials", () => {
  it("keeps the notes edit that a refused fee percentage used to erase", async () => {
    const state = await saveClaimFinancials(
      idleState,
      form({
        claimId: stub.claim.id,
        settlementAmount: "412500",
        feePercent: "250",
        notes: "Carrier's second offer, still short of the estimate.",
      }),
    );

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.feePercent).toBe("Enter a percentage between 0 and 100.");
    expect(state.values?.notes).toBe("Carrier's second offer, still short of the estimate.");
    expect(state.values?.feePercent).toBe("250");
  });

  it("flags both figures and returns both", async () => {
    const state = await saveClaimFinancials(
      idleState,
      form({
        claimId: stub.claim.id,
        settlementAmount: "abc",
        feePercent: "250",
        notes: "",
      }),
    );

    expect(state.fieldErrors?.settlementAmount).toBeDefined();
    expect(state.fieldErrors?.feePercent).toBeDefined();
    expect(state.message).toBe("Check the highlighted fields and save again.");
    expect(state.values?.settlementAmount).toBe("abc");
  });
});

describe("submittedValues", () => {
  it("takes strings only, so an upload can never be echoed into a defaultValue", () => {
    const data = new FormData();
    data.append("kind", "lor_signed");
    data.append("files", new File(["bytes"], "letter.pdf", { type: "application/pdf" }));

    expect(submittedValues(data, ["kind", "files"])).toEqual({ kind: "lor_signed" });
  });

  it("omits a field the form never sent rather than inventing an empty one", () => {
    expect(submittedValues(form({ a: "1" }), ["a", "b"])).toEqual({ a: "1" });
  });
});
