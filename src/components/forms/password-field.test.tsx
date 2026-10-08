import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DANGER } from "./field";
import { PasswordField } from "./password-field";

function passwordInput(label: string | RegExp = "Password") {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe("PasswordField", () => {
  it("starts hidden, with a Show password button that is not pressed", () => {
    render(<PasswordField name="password" label="Password" />);

    expect(passwordInput().type).toBe("password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(passwordInput().id);
    expect(toggle.querySelector('[data-icon="eye"]')).not.toBeNull();
  });

  it("shows and hides the password, changing the label and pressed state", () => {
    render(<PasswordField name="password" label="Password" />);

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput().type).toBe("text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");
    expect(hide.querySelector('[data-icon="eye-off"]')).not.toBeNull();

    fireEvent.click(hide);
    expect(passwordInput().type).toBe("password");
    expect(
      screen.getByRole("button", { name: "Show password" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("keeps the typed value when the visibility changes", () => {
    render(<PasswordField name="password" label="Password" />);

    fireEvent.change(passwordInput(), { target: { value: "throwaway-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput().value).toBe("throwaway-value");
  });

  it("is a type=button control that never submits its form", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordField name="password" label="Password" />
      </form>,
    );

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle.getAttribute("type")).toBe("button");
    fireEvent.click(toggle);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides the password again when the form submits", () => {
    render(
      <form onSubmit={(event) => event.preventDefault()}>
        <PasswordField name="password" label="Password" />
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput().type).toBe("text");

    fireEvent.submit(passwordInput().form as HTMLFormElement);
    expect(passwordInput().type).toBe("password");
  });

  it("passes name, autoComplete, required, minLength and the label through", () => {
    render(
      <PasswordField
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        required
        minLength={12}
      />,
    );

    const input = passwordInput(/^New password/);
    expect(input.name).toBe("newPassword");
    expect(input.id).toBe("field-newPassword");
    expect(input.getAttribute("autocomplete")).toBe("new-password");
    expect(input.required).toBe(true);
    expect(input.minLength).toBe(12);
  });

  it("wires the error and hint into aria-describedby, as TextField does", () => {
    render(
      <PasswordField
        name="password"
        label="Password"
        error="Enter your password."
        hint="At least 12 characters."
      />,
    );

    const input = passwordInput();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(
      "field-password-error field-password-hint",
    );
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(input.className).toContain(`aria-invalid:border-[${DANGER}]`);
  });

  it("reserves room on the right so text never runs under the button", () => {
    render(<PasswordField name="password" label="Password" />);

    const input = passwordInput();
    expect(input.className).toContain("pr-[50px]");
    expect(input.className).not.toMatch(/(^|\s)px-/);
  });

  it("disables the toggle with the field", () => {
    render(<PasswordField name="password" label="Password" disabled />);

    expect(passwordInput().disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Show password" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
