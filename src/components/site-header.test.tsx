import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/services",
}));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function toggle() {
  return screen.getByRole("button", { name: /menu$/i });
}

function panel() {
  return document.getElementById("site-mobile-menu");
}

/* The panel stays mounted so it can transition in both directions, so
   "closed" is no longer "absent". `inert` is the stronger contract anyway:
   it takes the panel out of the tab order, out of the a11y tree and out of
   hit-testing, which is what "closed" has to mean. */
function expectClosed() {
  const element = panel();
  expect(element).not.toBeNull();
  expect(element?.hasAttribute("inert")).toBe(true);
}

function expectOpen() {
  const element = panel();
  expect(element).not.toBeNull();
  expect(element?.hasAttribute("inert")).toBe(false);
}

describe("SiteHeader", () => {
  it("marks the current route from the pathname, not from props", () => {
    render(<SiteHeader />);
    /* Both navs are in the DOM at once now. In a browser exactly one is ever
       exposed — the desktop nav is `display:none` under 1025px and the panel
       is `inert` when closed and `display:none` above 1025px — but jsdom
       emulates neither, so the query has to name which one it means. */
    const nav = screen.getByTestId("desktop-nav");
    expect(
      within(nav).getByRole("link", { name: "Services" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(nav).getByRole("link", { name: "About" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("wires the toggle to the panel it controls", () => {
    render(<SiteHeader />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().getAttribute("aria-controls")).toBe("site-mobile-menu");
    expectClosed();

    fireEvent.click(toggle());

    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().getAttribute("aria-label")).toBe("Close menu");
    expectOpen();
  });

  it("moves focus into the panel on open", () => {
    render(<SiteHeader />);
    fireEvent.click(toggle());
    expect(panel()?.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape and returns focus to the toggle", () => {
    render(<SiteHeader />);
    fireEvent.click(toggle());
    fireEvent.keyDown(document, { key: "Escape" });

    expectClosed();
    expect(document.activeElement).toBe(toggle());
  });

  it("closes when the scrim is clicked", () => {
    render(<SiteHeader />);
    fireEvent.click(toggle());
    expectOpen();

    fireEvent.click(screen.getByTestId("site-menu-scrim"));

    expectClosed();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps Tab inside the panel while it is open", () => {
    render(<SiteHeader />);
    fireEvent.click(toggle());

    const open = panel();
    expect(open).not.toBeNull();
    if (!open) return;

    const stops = Array.from(open.querySelectorAll<HTMLElement>("a[href]"));
    const last = stops[stops.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(toggle());
  });

  it("offers the claim and call actions inside the mobile panel", () => {
    render(<SiteHeader />);
    fireEvent.click(toggle());

    const open = panel();
    expect(open).not.toBeNull();
    if (!open) return;

    const scope = within(open);
    expect(
      scope.getByRole("link", { name: "File a claim" }).getAttribute("href"),
    ).toBe("/file-a-claim");
    expect(
      scope.getByRole("link", { name: /Call 24\/7/ }).getAttribute("href"),
    ).toBe("tel:4074885728");
  });
});
