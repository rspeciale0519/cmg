import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LegalPackageSnapshot } from "@/lib/legal/types";

const mocks = vi.hoisted(() => ({ issue: vi.fn(), read: vi.fn(), pdf: vi.fn() }));
vi.mock("@/lib/actions/legal-package-files", () => ({ issueLegalPackageDownload: mocks.issue }));
vi.mock("@/lib/legal/package-file-reader", () => ({ readPackageFile: mocks.read }));
vi.mock("@/lib/legal/package-summary", () => ({ createPackageSummaryPdf: mocks.pdf }));
import { LegalPackageDownload } from "./legal-package-download";

const snapshot: LegalPackageSnapshot = {
  id: "11111111-1111-4111-8111-111111111111", claimId: "claim-test", handoffId: "handoff-test",
  claimRef: "CMG-TEST", createdAt: "2026-11-15T12:00:00Z",
  firm: { name: "Synthetic firm", contactName: "Test", email: "test@example.invalid", phone: "" },
  summary: [], summaryNote: "Reviewed summary",
  documents: [{ id: "22222222-2222-4222-8222-222222222222", name: "original.pdf", mime: "application/pdf", sizeBytes: 3, updatedAt: "2026-11-15T12:00:00Z" }],
};
const fetchFile = vi.fn();
const createUrl = vi.fn();
const revokeUrl = vi.fn();
let clickDownload: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.supabase.co");
  vi.stubGlobal("fetch", fetchFile);
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = createUrl;
    static revokeObjectURL = revokeUrl;
  });
  clickDownload = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  mocks.issue.mockResolvedValue({ status: "success", url: "https://synthetic.supabase.co/storage/v1/object/sign/test", sizeBytes: 3 });
  mocks.read.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mocks.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  fetchFile.mockResolvedValue({ ok: true });
  createUrl.mockReturnValue("blob:synthetic-package");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("legal package download controls", () => {
  it("does not access files until requested and downloads only the reviewed part", async () => {
    const view = render(<LegalPackageDownload snapshot={snapshot} />);
    expect(mocks.issue).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download part 1 of 1" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Check your downloads"));
    expect(mocks.issue).toHaveBeenCalledTimes(1);
    const form = mocks.issue.mock.calls[0][1] as FormData;
    expect(form.get("packageId")).toBe(snapshot.id);
    expect(form.get("documentId")).toBe(snapshot.documents[0].id);
    expect(fetchFile).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ credentials: "omit", redirect: "error", cache: "no-store" }));
    expect(clickDownload).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /sent/i })).toBeNull();
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith("blob:synthetic-package");
  });

  it.each([
    { status: "error", message: "Private detail" },
    { status: "success", url: "https://synthetic.supabase.co/file", sizeBytes: 4 },
    { status: "success", url: "https://wrong.example.invalid/file", sizeBytes: 3 },
    { status: "success", url: "https://name:secret@synthetic.supabase.co/file", sizeBytes: 3 },
  ])("refuses an unavailable, changed, or unsafe file link", async (result) => {
    mocks.issue.mockResolvedValue(result);
    render(<LegalPackageDownload snapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: "Download part 1 of 1" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("could not be prepared"));
    expect(fetchFile).not.toHaveBeenCalled();
    expect(clickDownload).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).not.toContain("Private detail");
  });

  it("cancels while waiting for authorization and never fetches or downloads afterward", async () => {
    let complete!: (value: unknown) => void;
    mocks.issue.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    render(<LegalPackageDownload snapshot={snapshot} />);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Download part 1 of 1" });
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Cancel preparation" }));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Download part 1 of 1" }).disabled).toBe(false);
    await act(async () => { complete({ status: "success", url: "https://synthetic.supabase.co/file", sizeBytes: 3 }); });
    expect(screen.getByRole("status").textContent).toContain("cancelled");
    expect(fetchFile).not.toHaveBeenCalled();
    expect(clickDownload).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Download part 1 of 1" }).disabled).toBe(false);
  });

  it("blocks a missing document list", () => {
    render(<LegalPackageDownload snapshot={{ ...snapshot, documents: [] }} />);
    expect(screen.getByRole("alert").textContent).toContain("invalid document list");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("starts a new snapshot with clear controls and ignores an old pending response", async () => {
    let complete!: (value: unknown) => void;
    mocks.issue.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const view = render(<LegalPackageDownload snapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: "Download part 1 of 1" }));
    view.rerender(<LegalPackageDownload snapshot={{ ...snapshot, id: "33333333-3333-4333-8333-333333333333" }} />);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Download part 1 of 1" }).disabled).toBe(false);
    await act(async () => { complete({ status: "success", url: "https://synthetic.supabase.co/file", sizeBytes: 3 }); });
    expect(screen.queryByRole("status")).toBeNull();
    expect(fetchFile).not.toHaveBeenCalled();
    expect(clickDownload).not.toHaveBeenCalled();
  });
});
