import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  rpc: vi.fn(), requireStaff: vi.fn(), requireOwner: vi.fn(), schedule: vi.fn(), refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: stubs.refresh }));
vi.mock("@/lib/authz", () => ({ requireStaff: stubs.requireStaff, requireOwner: stubs.requireOwner }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: stubs.rpc }) }));
vi.mock("@/lib/airtable/store", () => ({ scheduleAirtableDelivery: stubs.schedule }));

import { saveLawFirm, startLegalHandoff, prepareLegalPackage, recordLegalMilestone, cancelLegalPreparation } from "./legal";
import { idleState } from "./types";

const claimId = "46000000-0000-4000-a000-000000000001";
const handoffId = "46000000-0000-4000-b000-000000000001";
const requestId = "46000000-0000-4000-8000-000000000001";
function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  return data;
}
const milestone = { handoffId, requestId, expectedVersion: "2", milestone: "accepted", occurredOn: "2026-01-10", returnStatus: "", confirmed: "on" };

beforeEach(() => {
  vi.clearAllMocks();
  stubs.requireStaff.mockResolvedValue({ role: "owner" });
  stubs.requireOwner.mockResolvedValue({ role: "owner" });
  stubs.rpc.mockResolvedValue({ data: { claimId }, error: null });
});

describe("legal server actions", () => {
  it("checks the staff session before any database request", async () => {
    stubs.requireStaff.mockRejectedValueOnce(new Error("not available"));
    await expect(recordLegalMilestone(idleState, form(milestone))).rejects.toThrow("not available");
    expect(stubs.rpc).not.toHaveBeenCalled();
  });

  it("checks Owner access before changing the law-firm directory", async () => {
    stubs.requireOwner.mockRejectedValueOnce(new Error("not available"));
    await expect(saveLawFirm(idleState, form({}))).rejects.toThrow("not available");
    expect(stubs.rpc).not.toHaveBeenCalled();
  });

  it("requires actual milestone confirmation", async () => {
    const result = await recordLegalMilestone(idleState, form({ ...milestone, confirmed: "" }));
    expect(result.status).toBe("error");
    expect(stubs.rpc).not.toHaveBeenCalled();
  });

  it("does not let an acceptance change the return stage", async () => {
    const result = await recordLegalMilestone(idleState, form({ ...milestone, returnStatus: "negotiating" }));
    expect(result.status).toBe("error");
    expect(stubs.rpc).not.toHaveBeenCalled();
  });

  it("sends the guarded milestone request without a caller-controlled portal address", async () => {
    const result = await recordLegalMilestone(idleState, form({ ...milestone, portalUrl: "https://untrusted.invalid" }));
    expect(result.status).toBe("success");
    expect(stubs.rpc).toHaveBeenCalledWith("record_legal_milestone", {
      p_handoff_id: handoffId, p_expected_version: 2, p_milestone: "accepted",
      p_occurred_on: "2026-01-10", p_return_status: null, p_request_id: requestId,
    });
    expect(stubs.schedule).toHaveBeenCalledWith(claimId);
    expect(stubs.refresh).toHaveBeenCalledWith(`/portal/claims/${claimId}`, "layout");
  });

  it("keeps a database refusal generic and leaves sharing unscheduled", async () => {
    stubs.rpc.mockResolvedValueOnce({ data: null, error: { message: "private record detail" } });
    const result = await recordLegalMilestone(idleState, form(milestone));
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("private record detail");
    expect(stubs.schedule).not.toHaveBeenCalled();
  });

  it("does not report a malformed saved result as confirmed", async () => {
    stubs.rpc.mockResolvedValueOnce({ data: {}, error: null });
    const result = await recordLegalMilestone(idleState, form(milestone));
    expect(result.status).toBe("error");
    expect(result.message).toContain("was saved");
    expect(stubs.schedule).not.toHaveBeenCalled();
  });

  it("does not prepare an empty or foreign-field package", async () => {
    const result = await prepareLegalPackage(idleState, form({ handoffId, requestId, documentIds: [], summaryFields: ["internal_notes"], summaryNote: "" }));
    expect(result.status).toBe("error");
    expect(stubs.rpc).not.toHaveBeenCalled();
  });

  it("starts preparation without accepting a supplied status", async () => {
    const result = await startLegalHandoff(idleState, form({ claimId, firmId: handoffId, requestId, status: "with_law_firm" }));
    expect(result.status).toBe("success");
    expect(stubs.rpc).toHaveBeenCalledWith("start_legal_handoff", { p_claim_id: claimId, p_firm_id: handoffId, p_request_id: requestId });
    expect(result.message).toContain("No documents or emails were sent");
  });

  it("requires confirmation before cancelling unsent preparation", async () => {
    const result = await cancelLegalPreparation(idleState, form({ handoffId, requestId, expectedVersion: "1" }));
    expect(result.status).toBe("error");
    expect(stubs.rpc).not.toHaveBeenCalled();
  });

  it("cancels only through the version-checked database operation", async () => {
    const result = await cancelLegalPreparation(idleState, form({ handoffId, requestId, expectedVersion: "1", confirmed: "on" }));
    expect(result.status).toBe("success");
    expect(stubs.rpc).toHaveBeenCalledWith("cancel_legal_preparation", { p_handoff_id: handoffId, p_expected_version: 1, p_request_id: requestId });
    expect(result.message).toContain("No homeowner notice was sent");
  });
});
