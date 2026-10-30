import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentDownload as StaffDownload } from "@/components/admin/document-download";
import { DocumentDownload as HomeownerDownload } from "@/components/portal/document-controls";

const formStatus = vi.hoisted(() => ({ pending: false }));
vi.mock("react-dom", async (importOriginal) => ({
  ...await importOriginal<typeof import("react-dom")>(),
  useFormStatus: () => ({ pending: formStatus.pending }),
}));
vi.mock("@/lib/actions/documents", () => ({ issueDocumentDownload: vi.fn() }));
vi.mock("@/lib/actions/portal-documents", () => ({ issuePortalDownload: vi.fn() }));

afterEach(() => { cleanup(); formStatus.pending = false; });

describe.each([
  { role: "staff", Component: StaffDownload },
  { role: "homeowner", Component: HomeownerDownload },
])("$role document download", ({ Component }) => {
  it("names each download with its file name", () => {
    render(<><Component documentId="one" label="same.pdf" position={1} count={2} /><Component documentId="two" label="same.pdf" position={2} count={2} /></>);
    expect(screen.getByRole("button", { name: "Download same.pdf, file 1 of 2 on this page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download same.pdf, file 2 of 2 on this page" })).toBeTruthy();
  });

  it("disables the button and shows preparation while pending", () => {
    formStatus.pending = true;
    render(<Component documentId="one" label="first.pdf" position={1} count={1} />);
    expect(screen.getByRole("button", { name: "Preparing…" }).hasAttribute("disabled")).toBe(true);
  });
});
