import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract this pins, across every action a staff surface offers CMG:
 * **authorization refuses before any write, an RLS zero-row result is mapped
 * to a sentence rather than left as a silent no-op, the database's own error
 * codes (42501, 23514, 23503, CMG01) are translated into the right refusal,
 * and every mutation the spec asks to be audited is.**
 *
 * `advanceClaimStatus`'s `lor_signed` gate gets its own section because it is
 * spec §5's one gate that is not expressible as a pair of statuses — it reads
 * a `documents` row rather than a column — and it is enforced twice (here, and
 * again by the database trigger underneath). Only the first layer is this
 * file's business; the second is covered in the pgTAP suite.
 *
 * The stubs stop at the module boundary. Nothing here reaches Postgres, so
 * nothing here is an authorization test in the deep sense — `requireStaff`,
 * `requireOwner`, `claims_update_manage`, `partner_companies_*_owner`,
 * `guard_profile_privileges()` and `change_staff_privileges` are the real
 * gates and are covered in the pgTAP suite. What is tested here is that this
 * codebase asks them, in the right order, and turns their answer into the
 * right sentence.
 */

const stub = vi.hoisted(() => {
  const OWNER_ID = "00000000-0000-4000-a000-000000000001";
  const ADJUSTER_ID = "00000000-0000-4000-a000-000000000002";
  const OTHER_ADJUSTER_ID = "00000000-0000-4000-a000-000000000003";
  const CLAIM_ID = "24000000-0000-4000-a000-000000000001";
  const DOCUMENT_ID = "29000000-0000-4000-a000-000000000001";
  const COMPANY_ID = "10000000-0000-4000-a000-000000000001";
  const STAFF_ID = "00000000-0000-4000-a000-000000000004";

  return {
    OWNER_ID,
    ADJUSTER_ID,
    OTHER_ADJUSTER_ID,
    CLAIM_ID,
    DOCUMENT_ID,
    COMPANY_ID,
    STAFF_ID,

    session: { userId: OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" as string },

    claim: {
      id: CLAIM_ID,
      claim_ref: "CMG-2026-0007",
      status: "lor_sent",
      assigned_adjuster_id: ADJUSTER_ID,
      carrier: "Citizens Property Insurance",
      policy_number: "FL-CPI-4410",
      carrier_tenure: null,
      lor_contract_type: null,
    },
    claimReadError: null as { message: string } | null,
    claimUpdateResult: { data: [{ id: CLAIM_ID }], error: null as { message: string } | null },
    allowedTransitions: ["lor_signed", "rejected"] as string[],
    documentsForGate: [] as Array<{ id: string }>,
    reassignError: null as { code: string; message: string } | null,

    document: { id: DOCUMENT_ID, claim_id: CLAIM_ID },
    documentDeleteResult: {
      data: [{ id: DOCUMENT_ID, claim_id: CLAIM_ID }] as Array<{ id: string; claim_id: string }> | null,
      error: null as { message: string } | null,
    },

    partnerCompany: { id: COMPANY_ID, name: "Summit Exteriors LLC", status: "active" },
    partnerStatusUpdateResult: {
      data: { id: COMPANY_ID, name: "Summit Exteriors LLC" } as { id: string; name: string } | null,
      error: null as { message: string } | null,
    },
    partnerDeleteResult: {
      data: [{ id: COMPANY_ID }] as Array<{ id: string }> | null,
      error: null as { code: string; message: string } | null,
    },

    targetProfile: {
      id: STAFF_ID,
      first_name: "Sam",
      last_name: "Rivera",
      role: "adjuster" as string,
      is_active: true,
    },
    roster: [
      { id: OWNER_ID, role: "owner" as const, isActive: true },
      { id: STAFF_ID, role: "adjuster" as const, isActive: true },
    ],
    changeStaffError: null as { code: string; message: string } | null,

    issueInviteResult: { ok: true, url: "https://cmg.test/invite/abc", queued: true },
    resendKey: null as string | null,
    transitionWarnings: [] as string[],

    audited: vi.fn(),
    updated: vi.fn(),
    rpcCalls: [] as Array<{ name: string; args: unknown }>,
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn(async (_admin: unknown, entry: unknown) => {
    stub.audited(entry);
  }),
}));

vi.mock("@/lib/authz", () => ({
  requireStaff: vi.fn(async () => stub.session),
  requireOwner: vi.fn(async () => {
    if (stub.session.role !== "owner") throw new Error("not-found");
    return stub.session;
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  clientIpFromHeaders: vi.fn(() => "203.0.113.9"),
  inetOrNull: vi.fn((value: string) => value),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({})) }));

vi.mock("@/lib/claims/record-transition", () => ({
  recordTransition: vi.fn(async () => stub.transitionWarnings),
}));

vi.mock("@/lib/admin/staff", () => ({
  loadStaffRoster: vi.fn(async () => stub.roster),
}));

vi.mock("@/lib/invites", () => ({
  issueInvite: vi.fn(async () => stub.issueInviteResult),
}));

vi.mock("@/lib/email/outbox", () => ({
  resendApiKey: vi.fn(() => stub.resendKey),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: async (name: string, args: unknown) => {
      stub.rpcCalls.push({ name, args });
      if (name === "reassign_claim") return { error: stub.reassignError };
      if (name === "allowed_claim_transitions") return { data: stub.allowedTransitions, error: null };
      if (name === "change_staff_privileges") return { error: stub.changeStaffError };
      throw new Error(`unexpected rpc: ${name}`);
    },
    from: (table: string) => {
      if (table === "claims") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: stub.claim, error: stub.claimReadError }) }),
          }),
          update: (patch: unknown) => {
            stub.updated("claims", patch);
            const afterEq = {
              select: async () => stub.claimUpdateResult,
              eq: () => ({ select: async () => stub.claimUpdateResult }),
            };
            return { eq: () => afterEq };
          },
        };
      }
      if (table === "documents") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ limit: async () => ({ data: stub.documentsForGate, error: null }) }),
            }),
          }),
          delete: () => ({
            eq: () => ({ select: async () => stub.documentDeleteResult }),
          }),
        };
      }
      if (table === "partner_companies") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: stub.partnerCompany, error: null }) }),
          }),
          update: (patch: unknown) => {
            stub.updated("partner_companies", patch);
            return {
              eq: () => ({
                select: () => ({ maybeSingle: async () => stub.partnerStatusUpdateResult }),
              }),
            };
          },
          delete: () => ({
            eq: () => ({ select: async () => stub.partnerDeleteResult }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: stub.targetProfile, error: null }) }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  })),
}));

const { advanceClaimStatus, reassignClaimAdjuster } = await import("./claims");
const { rejectIntake } = await import("./intake-queue");
const { deleteClaimDocument } = await import("./documents");
const { setPartnerCompanyStatus, deletePartnerCompany, invitePartnerRep } = await import("./partners");
const { changeStaffRole, setStaffActive } = await import("./staff");
const { recheckIntegrations } = await import("./settings");
const { idleState, idleInviteIssueState } = await import("./types");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.session = { userId: stub.OWNER_ID, email: "owner@cmg.test", aal: "aal2", role: "owner" };
  stub.claim = {
    id: stub.CLAIM_ID,
    claim_ref: "CMG-2026-0007",
    status: "lor_sent",
    assigned_adjuster_id: stub.ADJUSTER_ID,
    carrier: "Citizens Property Insurance",
    policy_number: "FL-CPI-4410",
    carrier_tenure: null,
    lor_contract_type: null,
  };
  stub.claimReadError = null;
  stub.claimUpdateResult = { data: [{ id: stub.CLAIM_ID }], error: null };
  stub.allowedTransitions = ["lor_signed", "rejected"];
  stub.documentsForGate = [];
  stub.reassignError = null;
  stub.document = { id: stub.DOCUMENT_ID, claim_id: stub.CLAIM_ID };
  stub.documentDeleteResult = { data: [{ id: stub.DOCUMENT_ID, claim_id: stub.CLAIM_ID }], error: null };
  stub.partnerCompany = { id: stub.COMPANY_ID, name: "Summit Exteriors LLC", status: "active" };
  stub.partnerStatusUpdateResult = {
    data: { id: stub.COMPANY_ID, name: "Summit Exteriors LLC" },
    error: null,
  };
  stub.partnerDeleteResult = { data: [{ id: stub.COMPANY_ID }], error: null };
  stub.targetProfile = {
    id: stub.STAFF_ID,
    first_name: "Sam",
    last_name: "Rivera",
    role: "adjuster",
    is_active: true,
  };
  stub.roster = [
    { id: stub.OWNER_ID, role: "owner", isActive: true },
    { id: stub.STAFF_ID, role: "adjuster", isActive: true },
  ];
  stub.changeStaffError = null;
  stub.issueInviteResult = { ok: true, url: "https://cmg.test/invite/abc", queued: true };
  stub.resendKey = null;
  stub.transitionWarnings = [];
  stub.rpcCalls = [];
});

describe("advanceClaimStatus — the lor_signed document gate", () => {
  it("refuses lor_signed on a claim with no signed letter uploaded", async () => {
    stub.documentsForGate = [];

    const state = await advanceClaimStatus(
      idleState,
      form({ claimId: stub.CLAIM_ID, to: "lor_signed", note: "" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/signed letter of representation/);
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("allows lor_signed once a signed letter is on file", async () => {
    stub.documentsForGate = [{ id: "doc-1" }];

    const state = await advanceClaimStatus(
      idleState,
      form({ claimId: stub.CLAIM_ID, to: "lor_signed", note: "" }),
    );

    expect(state.status).toBe("success");
    expect(stub.updated).toHaveBeenCalledWith("claims", { status: "lor_signed" });
  });

  it("refuses a move the status machine itself does not allow", async () => {
    stub.allowedTransitions = ["rejected"];

    const state = await advanceClaimStatus(
      idleState,
      form({ claimId: stub.CLAIM_ID, to: "lor_signed", note: "" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/cannot move to/);
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("maps a zero-row RLS refusal to the assignment sentence, not a database detail", async () => {
    stub.documentsForGate = [{ id: "doc-1" }];
    stub.claimUpdateResult = { data: [], error: null };

    const state = await advanceClaimStatus(
      idleState,
      form({ claimId: stub.CLAIM_ID, to: "lor_signed", note: "" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/do not hold the authority/);
  });
});

describe("reassignClaimAdjuster", () => {
  it("refuses with the RLS-refusal sentence on 42501", async () => {
    stub.reassignError = { code: "42501", message: "not permitted" };

    const state = await reassignClaimAdjuster(
      idleState,
      form({ claimId: stub.CLAIM_ID, adjusterId: stub.OTHER_ADJUSTER_ID }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/do not hold the authority/);
  });

  it("refuses assignment to an inactive adjuster on 23514", async () => {
    stub.reassignError = { code: "23514", message: "check violated" };

    const state = await reassignClaimAdjuster(
      idleState,
      form({ claimId: stub.CLAIM_ID, adjusterId: stub.OTHER_ADJUSTER_ID }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toBe("A claim can only be assigned to an active adjuster.");
  });

  it("reassigns successfully and reports the claim reference", async () => {
    const state = await reassignClaimAdjuster(
      idleState,
      form({ claimId: stub.CLAIM_ID, adjusterId: stub.OTHER_ADJUSTER_ID }),
    );

    expect(state.status).toBe("success");
    expect(state.message).toContain(stub.claim.claim_ref);
  });

  it("reports the unassign message and does not redirect an owner releasing a claim", async () => {
    const state = await reassignClaimAdjuster(
      idleState,
      form({ claimId: stub.CLAIM_ID, adjusterId: "" }),
    );

    expect(state.status).toBe("success");
    expect(state.message).toMatch(/unassigned/);
  });

  it("redirects an adjuster who hands their own claim to someone else", async () => {
    stub.session = { userId: stub.ADJUSTER_ID, email: "adj@cmg.test", aal: "aal2", role: "adjuster" };

    await expect(
      reassignClaimAdjuster(
        idleState,
        form({ claimId: stub.CLAIM_ID, adjusterId: stub.OTHER_ADJUSTER_ID }),
      ),
    ).rejects.toThrow(/redirect:\/admin\/claims\?handedOn=/);
  });

  it("redirects an adjuster who releases their own claim to unassigned", async () => {
    stub.session = { userId: stub.ADJUSTER_ID, email: "adj@cmg.test", aal: "aal2", role: "adjuster" };

    await expect(
      reassignClaimAdjuster(idleState, form({ claimId: stub.CLAIM_ID, adjusterId: "" })),
    ).rejects.toThrow(/redirect:\/admin\/claims\?released=/);
  });

  it("does not redirect an adjuster reassigning a claim they keep", async () => {
    stub.session = { userId: stub.ADJUSTER_ID, email: "adj@cmg.test", aal: "aal2", role: "adjuster" };

    const state = await reassignClaimAdjuster(
      idleState,
      form({ claimId: stub.CLAIM_ID, adjusterId: stub.ADJUSTER_ID }),
    );

    expect(state.status).toBe("success");
  });
});

describe("rejectIntake — pinned to new_intake", () => {
  beforeEach(() => {
    stub.claim = {
      ...stub.claim,
      status: "new_intake",
    };
  });

  it("refuses a reason shorter than 4 characters and writes nothing", async () => {
    const state = await rejectIntake(idleState, form({ claimId: stub.CLAIM_ID, reason: "no" }));

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.reason).toBeDefined();
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("refuses an intake that is not new_intake, from the queue loader itself", async () => {
    stub.claim = { ...stub.claim, status: "under_review" };

    const state = await rejectIntake(
      idleState,
      form({ claimId: stub.CLAIM_ID, reason: "Not a fit for CMG" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/no longer in the queue/);
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("rejects the intake with a status filter that pins the update to new_intake", async () => {
    const state = await rejectIntake(
      idleState,
      form({ claimId: stub.CLAIM_ID, reason: "Roof damage predates policy inception." }),
    );

    expect(state.status).toBe("success");
    expect(stub.updated).toHaveBeenCalledWith("claims", { status: "rejected" });
    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({ action: "claim.intake_rejected" }),
    );
  });

  it("treats a race — another operator already moved the claim — as 'no longer in the queue'", async () => {
    stub.claimUpdateResult = { data: [], error: null };

    const state = await rejectIntake(
      idleState,
      form({ claimId: stub.CLAIM_ID, reason: "Roof damage predates policy inception." }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/no longer in the queue/);
  });
});

describe("deleteClaimDocument", () => {
  it("removes the document and revalidates its claim", async () => {
    const state = await deleteClaimDocument(idleState, form({ documentId: stub.DOCUMENT_ID }));

    expect(state.status).toBe("success");
    expect(state.message).toBe("Document removed.");
  });

  it("maps a zero-row refusal (signed LOR, or wrong role) to the explanatory sentence", async () => {
    stub.documentDeleteResult = { data: [], error: null };

    const state = await deleteClaimDocument(idleState, form({ documentId: stub.DOCUMENT_ID }));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/cannot be removed/);
  });

  it("refuses a malformed document id before reaching the database", async () => {
    const state = await deleteClaimDocument(idleState, form({ documentId: "not-a-uuid" }));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not available to you/);
  });
});

describe("setPartnerCompanyStatus", () => {
  it("refuses a status that is neither active nor inactive", async () => {
    const state = await setPartnerCompanyStatus(
      idleState,
      form({ companyId: stub.COMPANY_ID, status: "pending" }),
    );

    expect(state.status).toBe("error");
    expect(stub.updated).not.toHaveBeenCalled();
  });

  it("deactivates the company and audits the change", async () => {
    const state = await setPartnerCompanyStatus(
      idleState,
      form({ companyId: stub.COMPANY_ID, status: "inactive" }),
    );

    expect(state.status).toBe("success");
    expect(state.message).toMatch(/now inactive/);
    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({ action: "partner_company.status_changed", meta: expect.objectContaining({ status: "inactive" }) }),
    );
  });

  it("maps a not-found company to the not-found sentence", async () => {
    stub.partnerStatusUpdateResult = { data: null, error: null };

    const state = await setPartnerCompanyStatus(
      idleState,
      form({ companyId: stub.COMPANY_ID, status: "active" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not available/);
  });
});

describe("deletePartnerCompany — 23503 (linked reps) handling", () => {
  it("passes the guard trigger's own sentence through, capitalised, on 23503", async () => {
    stub.partnerDeleteResult = {
      data: null,
      error: { code: "23503", message: "summit exteriors llc has 2 linked reps; deactivate it instead" },
    };

    const state = await deletePartnerCompany(idleState, form({ companyId: stub.COMPANY_ID }));

    expect(state.status).toBe("error");
    expect(state.message).toBe("Summit exteriors llc has 2 linked reps; deactivate it instead.");
  });

  it("reports the generic error for any other failure code", async () => {
    stub.partnerDeleteResult = { data: null, error: { code: "XX000", message: "internal error" } };

    const state = await deletePartnerCompany(idleState, form({ companyId: stub.COMPANY_ID }));

    expect(state.status).toBe("error");
    expect(state.message).not.toContain("internal error");
  });

  it("redirects on a clean delete", async () => {
    await expect(deletePartnerCompany(idleState, form({ companyId: stub.COMPANY_ID }))).rejects.toThrow(
      "redirect:/admin/partners?deleted=1",
    );
  });
});

describe("invitePartnerRep — inactive-company refusal", () => {
  it("refuses to invite into an inactive company, and issues nothing", async () => {
    stub.partnerCompany = { id: stub.COMPANY_ID, name: "Summit Exteriors LLC", status: "inactive" };

    const state = await invitePartnerRep(
      idleInviteIssueState,
      form({ companyId: stub.COMPANY_ID, email: "rep@example.com", firstName: "Jordan" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/inactive/);
  });

  it("issues the invite for an active company", async () => {
    const state = await invitePartnerRep(
      idleInviteIssueState,
      form({ companyId: stub.COMPANY_ID, email: "rep@example.com", firstName: "Jordan" }),
    );

    expect(state.status).toBe("success");
  });
});

describe("changeStaffRole / setStaffActive — CMG01 and stranded-self handling", () => {
  it("maps CMG01 to the last-active-owner refusal", async () => {
    stub.changeStaffError = { code: "CMG01", message: "would strand the workspace" };
    stub.targetProfile = { id: stub.OWNER_ID, first_name: "Owner", last_name: "One", role: "owner", is_active: true };
    stub.roster = [{ id: stub.OWNER_ID, role: "owner", isActive: true }];

    const state = await changeStaffRole(
      idleState,
      form({ staffId: stub.OWNER_ID, role: "adjuster" }),
    );

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/only active owner/);
  });

  it("refuses in TypeScript before the database when the roster shows this would strand the workspace", async () => {
    stub.targetProfile = { id: stub.OWNER_ID, first_name: "Owner", last_name: "One", role: "owner", is_active: true };
    stub.roster = [{ id: stub.OWNER_ID, role: "owner", isActive: true }];

    const state = await setStaffActive(idleState, form({ staffId: stub.OWNER_ID, active: "false" }));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/only active owner/);
    expect(stub.rpcCalls.some((c) => c.name === "change_staff_privileges")).toBe(false);
  });

  it("redirects a staff member who deactivates their own account away from the stranded state — self message, no redirect for another owner watching", async () => {
    stub.session = { userId: stub.STAFF_ID, email: "sam@cmg.test", aal: "aal2", role: "owner" };
    stub.targetProfile = { id: stub.STAFF_ID, first_name: "Sam", last_name: "Rivera", role: "adjuster", is_active: true };
    stub.roster = [
      { id: stub.OWNER_ID, role: "owner", isActive: true },
      { id: stub.STAFF_ID, role: "adjuster", isActive: true },
    ];

    const state = await setStaffActive(idleState, form({ staffId: stub.STAFF_ID, active: "false" }));

    expect(state.status).toBe("success");
    expect(state.message).toMatch(/Your account is deactivated/);
  });

  it("changes another account's role and audits the change", async () => {
    const state = await changeStaffRole(
      idleState,
      form({ staffId: stub.STAFF_ID, role: "assistant" }),
    );

    expect(state.status).toBe("success");
    expect(stub.audited).toHaveBeenCalledWith(
      expect.objectContaining({ action: "staff.role_changed", meta: expect.objectContaining({ to: "assistant" }) }),
    );
  });

  it("reports the already-in-that-state message rather than a false 'changed'", async () => {
    const state = await changeStaffRole(
      idleState,
      form({ staffId: stub.STAFF_ID, role: "adjuster" }),
    );

    expect(state.status).toBe("success");
    expect(state.message).toMatch(/already/);
    expect(stub.rpcCalls).toHaveLength(0);
  });

  it("refuses a target that does not hold a staff role", async () => {
    stub.targetProfile = { id: stub.STAFF_ID, first_name: "Dana", last_name: "Homeowner", role: "customer", is_active: true };

    const state = await changeStaffRole(idleState, form({ staffId: stub.STAFF_ID, role: "assistant" }));

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/not available/);
  });
});

describe("recheckIntegrations", () => {
  it("succeeds for an owner and writes no audit row", async () => {
    const state = await recheckIntegrations();

    expect(state.status).toBe("success");
    expect(stub.audited).not.toHaveBeenCalled();
  });

  it("refuses a non-owner before reporting anything", async () => {
    stub.session = { userId: stub.STAFF_ID, email: "sam@cmg.test", aal: "aal2", role: "adjuster" };

    await expect(recheckIntegrations()).rejects.toThrow("not-found");
  });
});
