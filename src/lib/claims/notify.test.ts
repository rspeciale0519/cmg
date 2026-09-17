import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract this pins: **every claim-driven notification resolves its own
 * recipient, skips silently when there is nobody to tell, and never lets a
 * failed queue write turn a committed action into a thrown error.**
 *
 * `notify.ts` generalised a pattern `record-transition.ts` established, and the
 * risk in generalising five call sites into one module is that the skip rules —
 * an inactive partner, a claim with no claimant, a company with no contact email
 * — drift or get inlined incorrectly at one of the three call sites and not the
 * others. Each is asserted here directly against the function that owns it.
 *
 * The stubs stop at the module boundary. `enqueueNotifications` is exercised
 * through a fake service-role client rather than mocked outright, so a change to
 * which table a function reads, or in what order, shows up as a broken test
 * instead of passing silently against a mock that assumed the old shape.
 */

const dispatchOutbox = vi.fn(async () => {});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/outbox", () => ({
  dispatchOutbox,
  staffInbox: () => "staff@cmgpropertysolutions.net",
  outboxRows: (entries: Array<{ recipientEmail: string; dedupeKey?: string; message: { template: string; payload: unknown } }>) =>
    entries.map((entry) => ({
      recipient_email: entry.recipientEmail,
      dedupe_key: entry.dedupeKey ?? null,
      template: entry.message.template,
      payload: entry.message.payload,
    })),
}));

/** A chainable `.eq().eq().maybeSingle()` fake, matching every read in notify.ts. */
function chain(result: { data: unknown; error?: unknown }) {
  const node = {
    eq: () => node,
    maybeSingle: async () => ({ error: null, ...result }),
  };
  return node;
}

type FakeAdminConfig = {
  claim?: Record<string, unknown> | null;
  claimant?: Record<string, unknown> | null;
  adjuster?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
  insertResult?: Array<{ id: string }> | null;
  insertError?: { message: string } | null;
};

const inserted = vi.fn();

function fakeAdmin(config: FakeAdminConfig) {
  return {
    from: (table: string) => {
      if (table === "claims") return { select: () => chain({ data: config.claim ?? null }) };
      if (table === "claimants") return { select: () => chain({ data: config.claimant ?? null }) };
      if (table === "profiles") return { select: () => chain({ data: config.adjuster ?? null }) };
      if (table === "partner_companies") return { select: () => chain({ data: config.company ?? null }) };
      if (table === "notifications_outbox") {
        return {
          insert: (rows: unknown) => {
            inserted(rows);
            return {
              select: async () => ({
                data: config.insertResult ?? [{ id: "outbox-1" }],
                error: config.insertError ?? null,
              }),
            };
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

const { notifyStaffOfQuestion, notifyCustomerOfReply, notifyPartnerOfStatus, portalUrl, partnerPortalUrl } =
  await import("./notify");

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("portalUrl / partnerPortalUrl — derived from NEXT_PUBLIC_SITE_URL", () => {
  it("falls back to localhost when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(portalUrl()).toBe("http://localhost:3000/portal");
    expect(partnerPortalUrl()).toBe("http://localhost:3000/partner");
  });

  it("uses the configured site and trims a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cmgpropertysolutions.net/";
    expect(portalUrl()).toBe("https://cmgpropertysolutions.net/portal");
    expect(partnerPortalUrl()).toBe("https://cmgpropertysolutions.net/partner");
  });
});

describe("notifyStaffOfQuestion", () => {
  it("returns null and enqueues nothing when the claim cannot be found", async () => {
    createAdminClient.mockReturnValue(fakeAdmin({ claim: null }));

    const warning = await notifyStaffOfQuestion({ claimId: "c1", question: "Is my roof covered?" });

    expect(warning).toBeNull();
    expect(inserted).not.toHaveBeenCalled();
  });

  it("resolves the assigned adjuster's name and the claimant's name into the alert", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { claim_ref: "CMG-2026-0001", assigned_adjuster_id: "adj-1" },
        claimant: { first_name: "Dana", last_name: "Whitfield" },
        adjuster: { first_name: "Tyler", last_name: "Boone" },
      }),
    );

    const warning = await notifyStaffOfQuestion({ claimId: "c1", question: "Is my roof covered?" });

    expect(warning).toBeNull();
    expect(inserted).toHaveBeenCalledWith([
      expect.objectContaining({
        recipient_email: "staff@cmgpropertysolutions.net",
        template: "question_staff_alert",
        payload: expect.objectContaining({
          claimRef: "CMG-2026-0001",
          homeownerName: "Dana Whitfield",
          assignedTo: "Tyler Boone",
          question: "Is my roof covered?",
        }),
      }),
    ]);
  });

  it("falls back to a generic homeowner name and no assignee when neither is on file", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { claim_ref: "CMG-2026-0002", assigned_adjuster_id: null },
        claimant: null,
      }),
    );

    await notifyStaffOfQuestion({ claimId: "c2", question: "Any update?" });

    expect(inserted).toHaveBeenCalledWith([
      expect.objectContaining({
        payload: expect.objectContaining({ homeownerName: "The homeowner", assignedTo: undefined }),
      }),
    ]);
  });

  it("reports a warning, without throwing, when the enqueue write fails", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { claim_ref: "CMG-2026-0003", assigned_adjuster_id: null },
        claimant: null,
        insertError: { message: "connection reset" },
      }),
    );

    const warning = await notifyStaffOfQuestion({ claimId: "c3", question: "Hello?" });

    expect(warning).toBe("Your question was posted, but the alert to CMG could not be queued.");
  });
});

describe("notifyCustomerOfReply", () => {
  it("returns null when the claim cannot be found", async () => {
    createAdminClient.mockReturnValue(fakeAdmin({ claim: null }));

    expect(await notifyCustomerOfReply({ claimId: "c1", body: "We filed the letter today." })).toBeNull();
    expect(inserted).not.toHaveBeenCalled();
  });

  it("is skipped when the claim has no primary claimant on file", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({ claim: { claim_ref: "CMG-2026-0004" }, claimant: null }),
    );

    expect(await notifyCustomerOfReply({ claimId: "c1", body: "Update." })).toBeNull();
    expect(inserted).not.toHaveBeenCalled();
  });

  it("addresses the claimant's own email and includes the portal URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cmgpropertysolutions.net";
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { claim_ref: "CMG-2026-0005" },
        claimant: { first_name: "Dana", email: "dana@example.test" },
      }),
    );

    const warning = await notifyCustomerOfReply({ claimId: "c1", body: "We filed the letter today." });

    expect(warning).toBeNull();
    expect(inserted).toHaveBeenCalledWith([
      expect.objectContaining({
        recipient_email: "dana@example.test",
        template: "reply_posted",
        payload: expect.objectContaining({
          firstName: "Dana",
          claimRef: "CMG-2026-0005",
          body: "We filed the letter today.",
          portalUrl: "https://cmgpropertysolutions.net/portal",
        }),
      }),
    ]);
  });

  it("reports a warning, without throwing, when the enqueue write fails", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { claim_ref: "CMG-2026-0006" },
        claimant: { first_name: "Dana", email: "dana@example.test" },
        insertError: { message: "queue unavailable" },
      }),
    );

    const warning = await notifyCustomerOfReply({ claimId: "c1", body: "Update." });

    expect(warning).toBe(
      "The entry was posted, but the homeowner's notification could not be queued.",
    );
  });
});

describe("notifyPartnerOfStatus", () => {
  it("is skipped when the claim carries no partner company", async () => {
    createAdminClient.mockReturnValue(fakeAdmin({ claim: { partner_company_id: null } }));

    const warning = await notifyPartnerOfStatus({
      claimId: "c1",
      claimRef: "CMG-2026-0007",
      statusLabel: "Letter sent",
    });

    expect(warning).toBeNull();
    expect(inserted).not.toHaveBeenCalled();
  });

  it("is skipped when the company is inactive, even with a contact email on file", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { partner_company_id: "pc-1" },
        company: { name: "Summit Exteriors LLC", contact_email: "hello@summit.test", status: "inactive" },
      }),
    );

    const warning = await notifyPartnerOfStatus({
      claimId: "c1",
      claimRef: "CMG-2026-0008",
      statusLabel: "Letter sent",
    });

    expect(warning).toBeNull();
    expect(inserted).not.toHaveBeenCalled();
  });

  it("is skipped when the active company has no contact email on file", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { partner_company_id: "pc-1" },
        company: { name: "Summit Exteriors LLC", contact_email: null, status: "active" },
      }),
    );

    const warning = await notifyPartnerOfStatus({
      claimId: "c1",
      claimRef: "CMG-2026-0009",
      statusLabel: "Letter sent",
    });

    expect(warning).toBeNull();
    expect(inserted).not.toHaveBeenCalled();
  });

  it("addresses the company inbox and includes the partner portal URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://cmgpropertysolutions.net";
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { partner_company_id: "pc-1" },
        company: { name: "Summit Exteriors LLC", contact_email: "hello@summit.test", status: "active" },
        claimant: { first_name: "Dana", last_name: "Whitfield" },
      }),
    );

    const warning = await notifyPartnerOfStatus({
      claimId: "c1",
      claimRef: "CMG-2026-0010",
      statusLabel: "Letter of representation sent",
    });

    expect(warning).toBeNull();
    expect(inserted).toHaveBeenCalledWith([
      expect.objectContaining({
        recipient_email: "hello@summit.test",
        template: "partner_status_update",
        payload: expect.objectContaining({
          companyName: "Summit Exteriors LLC",
          claimRef: "CMG-2026-0010",
          homeownerName: "Dana Whitfield",
          statusLabel: "Letter of representation sent",
          partnerUrl: "https://cmgpropertysolutions.net/partner",
        }),
      }),
    ]);
  });

  it("reports a warning, without throwing, when the enqueue write fails", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { partner_company_id: "pc-1" },
        company: { name: "Summit Exteriors LLC", contact_email: "hello@summit.test", status: "active" },
        claimant: null,
        insertError: { message: "connection reset" },
      }),
    );

    const warning = await notifyPartnerOfStatus({
      claimId: "c1",
      claimRef: "CMG-2026-0011",
      statusLabel: "Letter sent",
    });

    expect(warning).toBe(
      "The status changed, but the referring partner's notification could not be queued.",
    );
  });
});

describe("enqueueNotifications wiring — used by all three notify functions", () => {
  it("attempts post-commit dispatch only after rows are actually inserted", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { claim_ref: "CMG-2026-0012", assigned_adjuster_id: null },
        claimant: null,
        insertResult: [{ id: "outbox-99" }],
      }),
    );

    await notifyStaffOfQuestion({ claimId: "c1", question: "Q" });

    expect(dispatchOutbox).toHaveBeenCalledWith(expect.anything(), ["outbox-99"]);
  });

  it("does not attempt dispatch when the insert reports zero rows", async () => {
    createAdminClient.mockReturnValue(
      fakeAdmin({
        claim: { claim_ref: "CMG-2026-0013", assigned_adjuster_id: null },
        claimant: null,
        insertResult: [],
      }),
    );

    await notifyStaffOfQuestion({ claimId: "c1", question: "Q" });

    expect(dispatchOutbox).not.toHaveBeenCalled();
  });
});
