import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter" }),
}));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("declares the smooth scroll contract required by Next route transitions", () => {
    const element = RootLayout({ children: null });

    expect(element.props["data-scroll-behavior"]).toBe("smooth");
  });
});
