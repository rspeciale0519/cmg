import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/invite", () => ({
  acceptInvite: vi.fn(async () => ({ status: "idle" })),
}));

import { InviteForm } from "./invite-form";

function renderForm() {
  return render(
    <InviteForm token="t" email="person@example.com" firstName="Ana" lastName="Diaz" />,
  );
}

describe("InviteForm", () => {
  /* The hint is unconditional: the page knows nothing about whether the address
     has an account, and must not, before the link is redeemed. */
  it("always tells an existing account holder that their password stays the same", () => {
    const { container } = renderForm();

    const hint = container.querySelector("#invite-existing-account-hint");
    expect(hint?.textContent).toMatch(/Already have a CMG account with this email\?/);
    expect(hint?.textContent).toMatch(/Your password will not\s+change\./);
    expect(hint?.textContent).toMatch(/ask you to sign in with it/);
  });

  it("gives both password fields a show/hide toggle without changing their names", () => {
    renderForm();

    const created = screen.getByLabelText(/^Create a password/) as HTMLInputElement;
    const confirm = screen.getByLabelText(/^Confirm password/) as HTMLInputElement;
    expect([created.type, confirm.type]).toEqual(["password", "password"]);
    expect([created.name, confirm.name]).toEqual(["password", "confirmPassword"]);
    expect(created.getAttribute("autocomplete")).toBe("new-password");
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(2);
  });
});
