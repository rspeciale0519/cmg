import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentUpload as StaffUpload } from "@/components/admin/document-upload";
import { DocumentUpload as HomeownerUpload } from "@/components/portal/document-controls";

vi.mock("@/lib/actions/documents", () => ({
  prepareClaimDocumentUpload: vi.fn(),
  finalizeClaimDocumentUpload: vi.fn(),
}));
vi.mock("@/lib/actions/portal-documents", () => ({
  preparePortalDocumentUpload: vi.fn(),
  finalizePortalDocumentUpload: vi.fn(),
  issuePortalDownload: vi.fn(),
}));

afterEach(cleanup);

const forms = [
  { role: "staff", element: () => <StaffUpload claimId="test-claim" canUploadRepresentation /> },
  { role: "homeowner", element: () => <HomeownerUpload claimId="test-claim" /> },
];

describe.each(forms)("$role private upload hydration", ({ element }) => {
  it("prevents file selection and submission before hydration without a native GET", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(element());
    const form = container.querySelector("form")!;
    expect(form.method).toBe("post");
    expect(form.getAttribute("action")).toBeNull();
    expect(form.querySelector("button[type=submit]")?.matches(":disabled")).toBe(true);
    expect(form.querySelector("input[type=file]")?.matches(":disabled")).toBe(true);
    for (const select of form.querySelectorAll("select")) {
      expect(select.matches(":disabled")).toBe(true);
    }
    expect(form.querySelector("noscript")?.textContent).toContain("Enable JavaScript");
  });

  it("enables file selection and submission after hydration", () => {
    const { container } = render(element());
    expect(container.querySelector("input[type=file]")?.matches(":disabled")).toBe(false);
    expect(container.querySelector("button[type=submit]")?.matches(":disabled")).toBe(false);
  });
});