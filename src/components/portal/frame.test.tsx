import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PortalFrame } from "./frame";

vi.mock("@/lib/actions/auth", () => ({
  signOut: vi.fn(),
}));

describe("PortalFrame", () => {
  it("keeps claim and account navigation available in the shared portal header", () => {
    render(
      <PortalFrame identity={{ name: "Alex Homeowner", email: "alex@example.com" }}>
        <p>Claim content</p>
      </PortalFrame>,
    );

    const nav = screen.getByRole("navigation", { name: "Client portal" });
    expect(
      within(nav).getByRole("link", { name: "My claim" }).getAttribute("href"),
    ).toBe("/portal");
    expect(
      screen
        .getByRole("link", { name: "Your account — Alex Homeowner" })
        .getAttribute("href"),
    ).toBe("/portal/profile");
    expect(
      screen.getByRole("button", { name: "Sign out" }).getAttribute("type"),
    ).toBe("submit");
  });
});
