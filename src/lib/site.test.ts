import { describe, expect, it } from "vitest";
import { emailHref, site, telHref } from "./site";

describe("site constants", () => {
  it("derives a dialable tel href from the display phone", () => {
    expect(telHref).toBe("tel:4074885728");
  });

  it("derives a mailto href from the contact email", () => {
    expect(emailHref).toBe(`mailto:${site.email}`);
  });

  it("carries the licensed adjuster number shown in the site footer", () => {
    expect(site.license).toBe("G086165");
  });
});
