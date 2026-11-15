import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LegalProgress } from "./legal-progress";

afterEach(cleanup);
describe("homeowner legal progress", () => {
  it("shows no legal panel for an ordinary claim", () => {
    const { container } = render(<LegalProgress progress={{ milestones: [], contact: null }} />);
    expect(container.textContent).toBe("");
  });
  it("shows recorded progress without adding contact details before acceptance", () => {
    render(<LegalProgress progress={{ milestones: [{ id: "milestone", handoff_id: "handoff", milestone: "sent", occurred_on: "2026-01-10", recorded_at: "2026-01-11" }], contact: null }} />);
    expect(screen.getByText("Sent to law firm")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("shows the accepted contact and a usable phone link", () => {
    render(<LegalProgress progress={{ milestones: [{ id: "milestone", handoff_id: "handoff", milestone: "accepted", occurred_on: "2026-01-10", recorded_at: "2026-01-11" }], contact: { name: "Test Firm", contactName: "Test Contact", email: "test@example.test", phone: "+1 (407) 555-0100" } }} />);
    expect(screen.getByRole<HTMLAnchorElement>("link", { name: "+1 (407) 555-0100" }).getAttribute("href")).toBe("tel:+14075550100");
    expect(screen.getByText("Test Firm")).toBeTruthy();
  });
});
