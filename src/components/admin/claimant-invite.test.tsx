import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `issueClaimantInvite` refuses this control in `staff` mode — `/invite` is
 * closed there — so it is replaced by a plain note rather than a button that
 * always fails. See `ClaimantInvite`'s own comment and
 * `src/lib/actions/invite-issuance-mode.test.ts` for the action side.
 */
vi.mock("@/lib/actions/invite", () => ({
  issueClaimantInvite: vi.fn(async () => ({ status: "success" as const })),
}));

import { ClaimantInvite } from "./claimant-invite";

afterEach(cleanup);

const base = {
  claimantId: "11111111-2222-4333-8444-555555555555",
  hasAccount: false,
  hasPendingInvite: false,
  acceptanceInProgress: false,
  canInvite: true,
};

describe("ClaimantInvite", () => {
  it("shows the paused note instead of a button when /invite is closed", () => {
    render(<ClaimantInvite {...base} inviteOpen={false} />);

    expect(
      screen.getByText("Invitations are paused until the customer portal opens."),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers the ordinary control when /invite is open", () => {
    render(<ClaimantInvite {...base} inviteOpen={true} />);

    expect(screen.getByRole("button", { name: "Send invite" })).toBeTruthy();
  });

  it("reports portal access before the invite surface, regardless of its state", () => {
    render(<ClaimantInvite {...base} hasAccount inviteOpen={false} />);

    expect(screen.getByText("Portal active")).toBeTruthy();
    expect(
      screen.queryByText("Invitations are paused until the customer portal opens."),
    ).toBeNull();
  });

  it("still names who can act when /invite is open but this caller cannot", () => {
    render(<ClaimantInvite {...base} canInvite={false} inviteOpen={true} />);

    expect(screen.getByText("Invited by the owner or the assigned adjuster")).toBeTruthy();
  });
});
