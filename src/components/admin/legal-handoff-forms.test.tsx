import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LegalHandoff, LegalPackageState } from "@/lib/legal/types";

vi.mock("@/lib/actions/legal", () => ({
  saveLawFirm: vi.fn(), startLegalHandoff: vi.fn(), prepareLegalPackage: vi.fn(),
  recordLegalMilestone: vi.fn(), cancelLegalPreparation: vi.fn(),
}));
vi.mock("./legal-package-download", () => ({ LegalPackageDownload: () => null }));
import { LawFirmForm, LegalMilestoneForm, LegalPackageForm, CancelLegalPreparationForm } from "./legal-handoff-forms";
import { prepareLegalPackage, recordLegalMilestone, saveLawFirm } from "@/lib/actions/legal";
import { CONNECTION_LOST } from "@/lib/actions/types";

const handoff: LegalHandoff = {
  id: "11111111-1111-4111-8111-111111111111", claim_id: "22222222-2222-4222-8222-222222222222",
  firm_id: "33333333-3333-4333-8333-333333333333", firm_snapshot: { name: "Test Firm", contactName: "Test Contact", email: "test@example.test", phone: "123" },
  milestone: null, prior_status: "documenting", version: 1, created_at: "2026-01-01", ended_at: null, outcome: null,
};
const requestId = "44444444-4444-4444-8444-444444444444";
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("legal staff controls", () => {
  it("does not allow Sent before a package is prepared", () => {
    render(<LegalMilestoneForm handoff={handoff} requestId={requestId} hasPackage={false} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Record milestone" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("checkbox").required).toBe(true);
  });

  it("requires a current stage for a declined handoff", () => {
    render(<LegalMilestoneForm handoff={{ ...handoff, milestone: "sent", version: 2 }} requestId={requestId} hasPackage />);
    fireEvent.change(screen.getByRole("combobox", { name: "Actual milestone" }), { target: { value: "declined" } });
    const stage = screen.getByRole<HTMLSelectElement>("combobox", { name: /^Confirm the current CMG stage/ });
    expect(stage.value).toBe("documenting");
    expect(stage.required).toBe(true);
  });

  it("preserves a returned milestone and date after refusal for a corrected submission", async () => {
    vi.mocked(recordLegalMilestone).mockResolvedValue({ status: "error", message: "Milestone could not be recorded." });
    render(<LegalMilestoneForm handoff={{ ...handoff, milestone: "sent", version: 2 }} requestId={requestId} hasPackage />);
    const milestone = screen.getByRole<HTMLSelectElement>("combobox", { name: "Actual milestone" });
    fireEvent.change(milestone, { target: { value: "returned" } });
    const stage = screen.getByRole<HTMLSelectElement>("combobox", { name: /^Confirm the current CMG stage/ });
    const date = screen.getByLabelText<HTMLInputElement>("Date it occurred");
    const confirmed = screen.getByRole<HTMLInputElement>("checkbox");
    fireEvent.change(stage, { target: { value: "negotiating" } });
    fireEvent.change(date, { target: { value: "2026-11-15" } });
    fireEvent.click(confirmed);

    await act(async () => { fireEvent.submit(milestone.form!); });

    expect(screen.getByText("Milestone could not be recorded.")).toBeTruthy();
    expect(milestone.value).toBe("returned");
    expect(stage.value).toBe("negotiating");
    expect(date.value).toBe("2026-11-15");
    expect(confirmed.checked).toBe(true);
    await act(async () => { fireEvent.submit(milestone.form!); });
    expect(recordLegalMilestone).toHaveBeenCalledTimes(2);
    const second = vi.mocked(recordLegalMilestone).mock.calls[1][1];
    expect(second.get("milestone")).toBe("returned");
    expect(second.get("occurredOn")).toBe("2026-11-15");
    expect(second.get("returnStatus")).toBe("negotiating");
    expect(second.get("confirmed")).toBe("on");
  });

  it.each(["empty refusal", "connection loss"])("keeps an unchecked law firm inactive after %s", async (failure) => {
    const firm = { id: handoff.firm_id, name: "Test Firm", contact_name: "Test Contact", contact_email: "test@example.test", contact_phone: "123", is_active: true };
    if (failure === "connection loss") vi.mocked(saveLawFirm).mockRejectedValue(new Error("Lost response"));
    else vi.mocked(saveLawFirm).mockResolvedValue({ status: "error", message: "Law firm could not be saved.", values: { isActive: "" } });
    render(<LawFirmForm firm={firm} />);
    const active = screen.getByRole<HTMLInputElement>("checkbox", { name: "Available for new handoffs" });
    fireEvent.click(active);

    await act(async () => { fireEvent.submit(active.form!); });

    expect(screen.getByText(failure === "connection loss" ? CONNECTION_LOST : "Law firm could not be saved.")).toBeTruthy();
    expect(active.checked).toBe(false);
    await act(async () => { fireEvent.submit(active.form!); });
    expect(vi.mocked(saveLawFirm).mock.calls[1][1].has("isActive")).toBe(false);
  });

  it("does not prepare a package before a document is selected", () => {
    render(<LegalPackageForm handoffId={handoff.id} requestId={requestId} documents={[{ id: requestId, original_name: "Original signed PDF.pdf", size_bytes: 100 }]} />);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Prepare package for review" });
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Original signed PDF/ }));
    expect(button.disabled).toBe(false);
  });

  it.each(["success", "error"] as const)("preserves reviewed package inputs after an action returns %s", async (status) => {
    const summaryNote = "Review the attached original letter.";
    const result: LegalPackageState = status === "success" ? {
      status, message: "Package prepared.", package: {
        id: requestId, claimId: handoff.claim_id, handoffId: handoff.id, claimRef: "CMG-TEST",
        createdAt: "2026-11-15T12:00:00Z", firm: handoff.firm_snapshot,
        summary: [{ label: "Claim", value: "CMG-TEST" }], summaryNote,
        documents: [{ id: requestId, name: "Original signed PDF.pdf", mime: "application/pdf", sizeBytes: 100, updatedAt: "2026-11-15T12:00:00Z" }],
      },
    } : { status, message: "Package could not be prepared." };
    vi.mocked(prepareLegalPackage).mockResolvedValue(result);
    render(<LegalPackageForm handoffId={handoff.id} requestId={requestId} documents={[{ id: requestId, original_name: "Original signed PDF.pdf", size_bytes: 100 }]} />);
    const document = screen.getByRole<HTMLInputElement>("checkbox", { name: /Original signed PDF/ });
    const homeowners = screen.getByRole<HTMLInputElement>("checkbox", { name: "Homeowner names and contact details" });
    const settlement = screen.getByRole<HTMLInputElement>("checkbox", { name: "Recorded settlement amount" });
    const note = screen.getByRole<HTMLTextAreaElement>("textbox", { name: /^Summary for the law firm/ });
    fireEvent.click(document);
    fireEvent.click(homeowners);
    fireEvent.click(settlement);
    fireEvent.change(note, { target: { value: summaryNote } });
    const form = document.form!;
    const reset = vi.fn();
    form.addEventListener("reset", reset);

    await act(async () => { fireEvent.submit(form); });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByText(result.message!)).toBeTruthy();
    expect(document.checked).toBe(true);
    expect(homeowners.checked).toBe(false);
    expect(settlement.checked).toBe(true);
    expect(note.value).toBe(summaryNote);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Prepare package for review" }).disabled).toBe(false);

    await act(async () => { fireEvent.submit(form); });

    expect(prepareLegalPackage).toHaveBeenCalledTimes(2);
    for (const [, data] of vi.mocked(prepareLegalPackage).mock.calls) {
      expect(data.getAll("documentIds")).toEqual([requestId]);
      expect(data.getAll("summaryFields")).toEqual(["claim", "property", "loss", "insurance", "adjuster", "settlement"]);
      expect(data.get("summaryNote")).toBe(summaryNote);
    }
  });

  it("clearly requires confirmation to cancel unsent preparation", () => {
    render(<CancelLegalPreparationForm handoff={handoff} requestId={requestId} />);
    expect(screen.getByRole<HTMLInputElement>("checkbox").required).toBe(true);
    expect(screen.getByRole("button", { name: "Cancel unsent preparation" })).toBeTruthy();
  });
});
