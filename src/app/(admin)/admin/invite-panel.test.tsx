import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `issueClaimantInvite` refuses every row on this panel in `staff` mode —
 * `/invite` is closed there — so the panel replaces itself with a plain note
 * instead of a button that always fails. See `InvitePanel`'s own comment and
 * `src/lib/actions/invite-issuance-mode.test.ts` for the action side of this
 * contract.
 */
vi.mock("@/lib/actions/invite", () => ({
  issueClaimantInvite: vi.fn(async () => ({ status: "success" as const })),
}));

import { InvitePanel } from "./invite-panel";

afterEach(cleanup);

const CLAIMANT = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "Dana Whitfield",
  email: "dana@example.com",
  claimRef: "CMG-2026-0050",
  canInvite: true,
};

describe("InvitePanel", () => {
  it("shows the paused note instead of any row when /invite is closed", () => {
    render(<InvitePanel claimants={[CLAIMANT]} total={1} inviteOpen={false} />);

    expect(
      screen.getByText("Invitations are paused until the customer portal opens."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send invite" })).toBeNull();
    expect(screen.queryByText(CLAIMANT.email)).toBeNull();
  });

  it("renders the ordinary repair list when /invite is open", () => {
    render(<InvitePanel claimants={[CLAIMANT]} total={1} inviteOpen={true} />);

    expect(screen.getByRole("button", { name: "Send invite" })).toBeTruthy();
    expect(
      screen.queryByText("Invitations are paused until the customer portal opens."),
    ).toBeNull();
  });

  it("still reports the empty state when /invite is open and nobody is waiting", () => {
    render(<InvitePanel claimants={[]} total={0} inviteOpen={true} />);

    expect(screen.getByText("Everyone on your claims has portal access.")).toBeTruthy();
  });
});
