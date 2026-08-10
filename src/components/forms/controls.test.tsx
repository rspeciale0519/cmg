import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelectField, TextAreaField, TextField } from "./controls";
import { DANGER, INPUT_CLASS } from "./field";

/* The invalid border is a specificity contract, not a class-order one.
   `border-ink/16` and a bare `border-[#E08C6A]` are both single-class
   selectors, so appending the danger utility to the class attribute does
   nothing — whichever Tailwind emits later wins, and it emitted the danger
   rule ~133 rules ahead of the resting border. The state therefore lives on
   an `aria-invalid:` variant, which resolves to `[aria-invalid="true"]` and
   outranks the resting border however the sheet is ordered. */
describe("form control invalid state", () => {
  const RESTING_BORDER = "border-ink/16";
  const DANGER_BORDER = `aria-invalid:border-[${DANGER}]`;

  it("carries the danger border as an aria-invalid variant, not a bare utility", () => {
    expect(INPUT_CLASS).toContain(RESTING_BORDER);
    expect(INPUT_CLASS).toContain(DANGER_BORDER);
    expect(INPUT_CLASS).toContain(`aria-invalid:hover:border-[${DANGER}]`);
    expect(INPUT_CLASS).toContain(
      `aria-invalid:focus-visible:border-[${DANGER}]`,
    );
  });

  /* The regression guard. A bare `border-[#E08C6A]` sitting beside
     `border-ink/16` is the exact pair that silently lost, so its absence is
     the invariant worth pinning — not the presence of the fix alone. */
  it("never pairs the resting border with an equal-specificity danger border", () => {
    for (const token of INPUT_CLASS.split(/\s+/)) {
      if (token.endsWith(`border-[${DANGER}]`)) {
        expect(token).toMatch(/^aria-invalid:/);
      }
    }
  });

  it("marks an errored control aria-invalid and a resting one not", () => {
    const { rerender } = render(
      <TextField name="phone" label="Phone" type="tel" />,
    );
    const resting = screen.getByLabelText("Phone");
    expect(resting.getAttribute("aria-invalid")).toBeNull();
    expect(resting.matches('[aria-invalid="true"]')).toBe(false);

    rerender(
      <TextField
        name="phone"
        label="Phone"
        type="tel"
        error="Enter a phone number."
      />,
    );
    const errored = screen.getByLabelText("Phone");
    expect(errored.getAttribute("aria-invalid")).toBe("true");
    /* The selector the danger rule is written against — matching it is what
       actually paints the border, which is what the old class-swap failed to
       do even with `aria-invalid` set correctly. */
    expect(errored.matches('[aria-invalid="true"]')).toBe(true);
    expect(errored.className).toContain(DANGER_BORDER);
  });

  it("applies the same contract to every control built on INPUT_CLASS", () => {
    render(
      <>
        <TextAreaField name="message" label="What happened?" error="Required." />
        <SelectField
          name="loss"
          label="Type of loss"
          error="Required."
          options={[{ value: "wind", label: "Wind" }]}
        />
      </>,
    );

    for (const label of ["What happened?", "Type of loss"]) {
      const control = screen.getByLabelText(label);
      expect(control.getAttribute("aria-invalid")).toBe("true");
      expect(control.className).toContain(DANGER_BORDER);
    }
  });
});
