import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PartnerNav } from "./partner-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/partner/profile",
}));

describe("PartnerNav", () => {
  it("keeps every mobile tab reachable and marks the active route", () => {
    render(<PartnerNav />);

    const nav = screen.getByRole("navigation", { name: "Partner portal" });
    const scroller = nav.querySelector("div");
    const list = within(nav).getByRole("list");
    const active = within(nav).getByRole("link", { name: "Company profile" });

    expect(scroller?.className).toContain("scroll-x-edged");
    expect(scroller?.className).toContain("w-full");
    expect(scroller?.className).toContain("[scrollbar-width:none]");
    expect(scroller?.className).toContain("[&::-webkit-scrollbar]:hidden");
    expect(scroller?.className).toContain("sm:overflow-x-visible");
    expect(scroller?.className).toContain("sm:bg-none");
    expect(list.className).toContain("w-max");
    expect(list.className).toContain("min-w-full");
    expect(list.className).toContain("pr-9");
    expect(list.className).toContain("sm:pr-0");
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("min-h-11");
    expect(active.className).toContain("after:bg-accent");
  });
});
