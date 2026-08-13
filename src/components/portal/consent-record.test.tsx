import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConsentRecord } from "./consent-record";

vi.mock("@/components/portal/consent-controls", () => ({
  WithdrawConsent: ({ kind }: { kind: "sms" | "email" }) => (
    <button type="button">Withdraw {kind} consent</button>
  ),
}));

const exactConsent =
  "I agree to receive claim updates by text at the number I provided.";

describe("ConsentRecord", () => {
  it("starts compact while retaining the exact consent and withdrawal action", () => {
    const { container } = render(
      <ConsentRecord
        consent={{
          id: "consent-1",
          kind: "sms",
          consent_text: exactConsent,
          granted_at: "2026-08-01T12:00:00Z",
          withdrawn_at: null,
        }}
      />,
    );

    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
    expect(screen.getByText("Text messages")).toBeDefined();
    expect(screen.getByText("In force")).toBeDefined();
    expect(screen.getByText(exactConsent).textContent).toBe(exactConsent);
    expect(screen.getByRole("button", { name: "Withdraw sms consent" })).toBeDefined();

    fireEvent.click(container.querySelector("summary") as HTMLElement);
    expect(details?.open).toBe(true);
  });

  it("keeps the withdrawal date and email delivery meaning in the record", () => {
    render(
      <ConsentRecord
        consent={{
          id: "consent-2",
          kind: "email",
          consent_text: exactConsent,
          granted_at: "2026-08-01T12:00:00Z",
          withdrawn_at: "2026-08-03T12:00:00Z",
        }}
      />,
    );

    expect(screen.getByText(/Withdrawn Aug/)).toBeDefined();
    expect(screen.getByText(/messages about the claim itself still reach you/)).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
