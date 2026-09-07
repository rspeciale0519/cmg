import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract these pin: **a save that changes nothing writes nothing.**
 *
 * `updateLeadStatus` used to run its UPDATE unconditionally, so pressing Save
 * beside an untouched select wrote `leads.status_changed` with `from` equal to
 * `to` and answered "Rosa Delgado marked new." — an entry in an append-only
 * forensic trail, and a sentence asserting an event, for a status that never
 * moved. `audit_log` is the record of what happened; a row in it that did not
 * happen is worse than a missing feature, and nothing else in the suite would
 * notice it reappearing.
 *
 * The button is also gated on a dirty flag in `LeadStatusForm`, which is the
 * half a reader sees. This is the half that holds when the form is submitted by
 * anything other than that button.
 *
 * The stubs stop at the module boundary: nothing here reaches Postgres, so
 * nothing here is an authorization test. `requireStaff` and `leads_update_staff`
 * are the real gates and are covered in the pgTAP suite.
 */

const stub = vi.hoisted(() => {
  const OWNER_ID = "0e37b7c6-1c1a-4a3e-9f21-0d2c6b7e4a11";
  const lead = {
    id: "9f2c1b7a-4d38-4a1e-8c62-77b0e5a91d40",
    name: "Rosa Delgado",
    status: "new",
  };

  return {
    OWNER_ID,
    lead,
    session: { userId: OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" },
    updated: vi.fn(),
    audited: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn(async (_client: unknown, entry: unknown) => {
    stub.audited(entry);
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/authz", () => ({ requireStaff: vi.fn(async () => stub.session) }));

/**
 * The read, then the update. `update()` records that it was called at all —
 * which is the assertion — and answers with one affected row so the success
 * path is reachable when the status really does change.
 */
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: stub.lead, error: null }) }),
      }),
      update: (patch: unknown) => {
        stub.updated(patch);
        return {
          eq: () => ({
            select: async () => ({ data: [{ id: stub.lead.id }], error: null }),
          }),
        };
      },
    }),
  })),
}));

import { updateLeadStatus } from "./leads";
import { idleState } from "./types";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateLeadStatus", () => {
  it("writes nothing when the requested status is the stored one", async () => {
    const state = await updateLeadStatus(
      idleState,
      form({ leadId: stub.lead.id, status: stub.lead.status }),
    );

    expect(stub.updated).not.toHaveBeenCalled();
    expect(stub.audited).not.toHaveBeenCalled();
    expect(state.status).toBe("success");
  });

  it("does not claim a move that did not happen", async () => {
    const state = await updateLeadStatus(
      idleState,
      form({ leadId: stub.lead.id, status: stub.lead.status }),
    );

    // "marked new" asserts an event. "is already new" reports a state.
    expect(state.message).toBe("Rosa Delgado is already new.");
    expect(state.message).not.toContain("marked");
  });

  it("still updates and audits a real move", async () => {
    const state = await updateLeadStatus(
      idleState,
      form({ leadId: stub.lead.id, status: "contacted" }),
    );

    expect(stub.updated).toHaveBeenCalledWith({ status: "contacted" });
    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "leads.status_changed",
        meta: { from: "new", to: "contacted" },
      }),
    );
    expect(state.status).toBe("success");
    expect(state.message).toBe("Rosa Delgado marked contacted.");
  });

  it("refuses a status that is not in the enum before reading anything", async () => {
    const state = await updateLeadStatus(
      idleState,
      form({ leadId: stub.lead.id, status: "archived" }),
    );

    expect(state.status).toBe("error");
    expect(stub.updated).not.toHaveBeenCalled();
    expect(stub.audited).not.toHaveBeenCalled();
  });
});
