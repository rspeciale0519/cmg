import { describe, expect, it } from "vitest";
import { adminESignState } from "./admin-state";

describe("adminESignState", () => {
  it.each([
    ["manual_pending", "manual_pending", "Manual signature pending"],
    ["document.sent", "sent", "Sent for signature"],
    ["document.viewed", "viewed", "Viewed by a signer"],
    ["recipient.completed:1:2", "recipient_completed", "Signer completed"],
    ["document.completed", "completed", "Signing completed"],
    ["document.declined", "declined", "Signature declined"],
    ["document.cancelled", "voided", "Signing request voided"],
    ["document.voided", "voided", "Signing request voided"],
    ["document.expired", "expired", "Signing request expired"],
    ["document.creation_failed", "creation_failed", "Signing request creation failed"],
  ])("maps %s to the explicit %s admin state", (raw, key, label) => {
    expect(adminESignState(raw, "lor_sent")).toMatchObject({ key, label });
  });

  it("names recipient progress instead of collapsing it to sent", () => {
    const state = adminESignState("recipient.completed:1:2", "lor_sent");
    expect(state.detail).toContain("1 of 2 recipients signed");
    expect(state.label).not.toMatch(/sent for signature/i);
  });

  it("distinguishes provider completion awaiting its PDF from a filed LOR", () => {
    expect(adminESignState("document.completed", "lor_sent").detail).toMatch(/PDF.*waiting/i);
    expect(adminESignState("document.completed", "lor_signed").detail).toMatch(/filed/i);
  });

  it.each([
    "document.declined",
    "document.cancelled",
    "document.expired",
    "document.creation_failed",
  ])("never describes %s merely as an LOR sent", (raw) => {
    const state = adminESignState(raw, "lor_sent");
    expect(state.recoverable).toBe(true);
    expect(`${state.label} ${state.detail}`).not.toMatch(/^LOR sent$/i);
    expect(state.label).not.toMatch(/sent for signature/i);
  });

  it("does not offer recovery for an unknown provider status", () => {
    const state = adminESignState("document.some_new_failure", "lor_sent");

    expect(state.label).toBe("Provider status needs review");
    expect(state.recoverable).toBe(false);
  });

  it("treats a legacy claim past representation as completed when no provider mirror exists", () => {
    expect(adminESignState(null, "settlement_offered")).toMatchObject({
      key: "completed",
      label: "Representation completed",
      recoverable: false,
    });
  });
});
