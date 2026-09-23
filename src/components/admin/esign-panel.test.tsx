import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ download: vi.fn() }));

vi.mock("@/lib/actions/esign", () => ({
  submitLorRecovery: vi.fn(async () => ({ status: "success" })),
  downloadPrefilledLor: (...args: unknown[]) => mocks.download(...args),
}));

import { ESignPanel } from "./esign-panel";

afterEach(cleanup);

const base = {
  claimId: "11111111-2222-4333-8444-555555555555",
  requestId: "99999999-8888-4777-8666-555555555555",
  claimStatus: "lor_sent",
  providerDocumentId: "pd-current",
  canManage: true,
  electronicReady: true,
  electronicBlocker: null,
  providerMode: "pandadoc" as const,
};

describe("ESignPanel", () => {
  it.each([
    ["manual_pending", "Manual signature pending"],
    ["document.sent", "Sent for signature"],
    ["document.viewed", "Viewed by a signer"],
    ["recipient.completed:1:2", "Signer completed"],
    ["document.completed", "Signing completed"],
    ["document.declined", "Signature declined"],
    ["document.cancelled", "Signing request voided"],
    ["document.expired", "Signing request expired"],
    ["document.creation_failed", "Signing request creation failed"],
    ["document.send_uncertain", "Delivery confirmation pending"],
  ])("renders %s as %s", (esignStatus, label) => {
    render(<ESignPanel {...base} esignStatus={esignStatus} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("offers both retry and fixed manual recovery on a failure", () => {
    render(<ESignPanel {...base} esignStatus="document.declined" />);
    expect(screen.getByRole("button", { name: "Retry e-signature" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use manual signing" })).toBeTruthy();
  });

  it("offers retry and manual fallback after a creation failure on an under-review claim", () => {
    render(
      <ESignPanel {...base} claimStatus="under_review" esignStatus="document.creation_failed" />,
    );
    expect(screen.getByRole("button", { name: "Retry e-signature" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use manual signing" })).toBeTruthy();
  });

  it("offers an initial send only from under review", () => {
    render(<ESignPanel {...base} claimStatus="under_review" esignStatus={null} />);
    expect(screen.getByRole("button", { name: "Send for e-signature" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use manual signing" })).toBeTruthy();
  });

  it("shows legacy represented claims as complete without unusable recovery controls", () => {
    render(<ESignPanel {...base} claimStatus="settlement_offered" esignStatus={null} />);
    expect(screen.getByText("Representation completed")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not offer recovery controls for an unknown provider state", () => {
    render(<ESignPanel {...base} esignStatus="document.some_new_failure" />);
    expect(screen.getByText("Provider status needs review")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows state but no recovery controls to a read-only assistant", () => {
    render(<ESignPanel {...base} canManage={false} esignStatus="document.expired" />);
    expect(screen.getByText("Signing request expired")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/owner or assigned adjuster/i)).toBeTruthy();
  });

  it("does not offer retry while the current request is active", () => {
    render(<ESignPanel {...base} esignStatus="document.viewed" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("gives safe reconciliation instructions for an uncertain send", () => {
    render(<ESignPanel {...base} esignStatus="document.send_uncertain" />);
    expect(screen.getByText(/do not resend or switch to manual signing/i)).toBeTruthy();
    expect(screen.getByText(/matching webhook will reconcile/i)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("points manual recovery to signed-LOR upload", () => {
    render(<ESignPanel {...base} esignStatus="manual_pending" />);
    expect(screen.getByRole("link", { name: "Documents" }).getAttribute("href")).toBe(
      `/admin/claims/${base.claimId}/documents`,
    );
  });

  /**
   * The no-API-key path. CMG signs through PandaDoc's web app rather than its
   * API, so the letter has to leave the desk as a file. The control appears
   * only when the platform itself cannot send it, and the line beside it is
   * the whole procedure staff follow next.
   */
  it("offers the prefilled letter, with upload guidance, when the provider is manual", () => {
    render(
      <ESignPanel
        {...base}
        providerMode="manual"
        claimStatus="under_review"
        esignStatus={null}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Download letter for signing" }),
    ).toBeTruthy();
    expect(screen.getByText(/upload it to pandadoc/i)).toBeTruthy();
    // No dead electronic button without an API key; the manual action is named
    // for what it records.
    expect(screen.queryByRole("button", { name: "Send for e-signature" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mark letter as sent" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Use manual signing" })).toBeNull();
  });

  it("lists the manual steps in the order staff work them", () => {
    render(
      <ESignPanel
        {...base}
        providerMode="manual"
        claimStatus="under_review"
        esignStatus={null}
      />,
    );
    const download = screen.getByRole("button", { name: "Download letter for signing" });
    const markSent = screen.getByRole("button", { name: "Mark letter as sent" });
    expect(
      download.compareDocumentPosition(markSent) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText(/after you send the letter from pandadoc/i)).toBeTruthy();
  });

  it("keeps both electronic and manual controls when PandaDoc is configured", () => {
    render(<ESignPanel {...base} claimStatus="under_review" esignStatus={null} />);
    expect(screen.getByRole("button", { name: "Send for e-signature" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use manual signing" })).toBeTruthy();
  });

  it("keeps offering the letter while a manual request is pending", () => {
    render(<ESignPanel {...base} providerMode="manual" esignStatus="manual_pending" />);
    expect(
      screen.getByRole("button", { name: "Download letter for signing" }),
    ).toBeTruthy();
  });

  it("does not offer the prefilled letter when PandaDoc can send it", () => {
    render(<ESignPanel {...base} claimStatus="under_review" esignStatus={null} />);
    expect(
      screen.queryByRole("button", { name: "Download letter for signing" }),
    ).toBeNull();
  });

  it("does not offer the prefilled letter to a read-only assistant", () => {
    render(
      <ESignPanel
        {...base}
        providerMode="manual"
        canManage={false}
        claimStatus="under_review"
        esignStatus={null}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Download letter for signing" }),
    ).toBeNull();
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
