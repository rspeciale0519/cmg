import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_NAV } from "./nav";
import { AdminNav } from "./admin-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

describe("AdminNav", () => {
  const scrollIntoView = vi.fn();
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    scrollIntoView.mockClear();
  });

  afterEach(() => {
    if (originalScrollIntoView) {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("scrolls a keyboard-focused link into view with room for its focus outline", () => {
    render(<AdminNav items={[...ADMIN_NAV]} counts={{ intake: 0, leads: 0 }} />);

    const claims = screen.getByRole("link", { name: "Claims" });
    scrollIntoView.mockClear();

    fireEvent.focus(claims);

    expect(scrollIntoView).toHaveBeenCalledWith({ inline: "nearest", block: "nearest" });
    expect(scrollIntoView.mock.contexts[0]).toBe(claims);
    expect(claims.className).toContain("scroll-mx-1");
  });

  it("keeps the active route aligned after navigation", () => {
    render(<AdminNav items={[...ADMIN_NAV]} counts={{ intake: 0, leads: 0 }} />);

    const dashboard = screen.getByRole("link", { name: "Dashboard" });

    expect(dashboard.getAttribute("aria-current")).toBe("page");
    expect(scrollIntoView).toHaveBeenCalledWith({ inline: "start", block: "nearest" });
    expect(scrollIntoView.mock.contexts[0]).toBe(dashboard);
  });
});
