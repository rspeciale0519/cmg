import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders a button element when no href is given", () => {
    render(<Button onClick={() => {}}>Submit intake</Button>);
    const control = screen.getByRole("button", { name: "Submit intake" });
    expect(control.tagName).toBe("BUTTON");
    expect(control.getAttribute("type")).toBe("button");
  });

  it("honours an explicit type so it can submit a form", () => {
    render(<Button type="submit">Submit intake</Button>);
    expect(
      screen.getByRole("button", { name: "Submit intake" }).getAttribute("type"),
    ).toBe("submit");
  });

  it("renders an anchor — never a nested control — when href is given", () => {
    render(<Button href="/file-a-claim">File a claim</Button>);
    const control = screen.getByRole("link", { name: "File a claim" });
    expect(control.tagName).toBe("A");
    expect(control.querySelector("button")).toBeNull();
  });

  it("keeps non-routable schemes on a plain anchor", () => {
    render(<Button href="tel:4074885728">Call 24/7</Button>);
    expect(
      screen.getByRole("link", { name: "Call 24/7" }).getAttribute("href"),
    ).toBe("tel:4074885728");
  });

  it("applies the accent border for primary and the divider border for secondary", () => {
    const { rerender } = render(<Button href="/a">One</Button>);
    expect(screen.getByRole("link").className).toContain("border-accent");

    rerender(
      <Button href="/a" variant="secondary">
        One
      </Button>,
    );
    expect(screen.getByRole("link").className).toContain("border-ink/16");
  });
});
