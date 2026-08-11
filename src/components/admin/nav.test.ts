import { describe, expect, it } from "vitest";
import { ADMIN_NAV, isAdminRouteActive, navFor } from "./nav";

describe("navFor", () => {
  it("gives an owner every destination", () => {
    expect(navFor("owner")).toHaveLength(ADMIN_NAV.length);
  });

  it("keeps the four owner surfaces away from adjusters and assistants", () => {
    for (const role of ["adjuster", "assistant"] as const) {
      const hrefs = navFor(role).map((item) => item.href);
      expect(hrefs).toEqual([
        "/admin",
        "/admin/intake",
        "/admin/leads",
        "/admin/questions",
        "/admin/claims",
      ]);
      expect(hrefs).not.toContain("/admin/audit");
      expect(hrefs).not.toContain("/admin/settings");
    }
  });

  it("gives every staff role the homeowner-question queue", () => {
    // It is the only cross-claim view of `type = 'question'`; the other one is
    // scoped to a single claim. An adjuster and an assistant both answer
    // homeowners, so both need the way in.
    for (const role of ["owner", "adjuster", "assistant"] as const) {
      expect(navFor(role).map((item) => item.href)).toContain("/admin/questions");
    }
  });

  it("shows nothing to a role that has no business in the workspace", () => {
    // The proxy and `requireStaff` both refuse a customer or partner long
    // before this runs; an empty nav is the third answer to the same question.
    expect(navFor("customer")).toEqual([]);
    expect(navFor("partner")).toEqual([]);
  });
});

describe("isAdminRouteActive", () => {
  it("matches the dashboard only on the dashboard", () => {
    // Every admin path starts with `/admin`, so a prefix match here would light
    // the Dashboard tab on every page in the workspace.
    expect(isAdminRouteActive("/admin", "/admin")).toBe(true);
    expect(isAdminRouteActive("/admin/claims", "/admin")).toBe(false);
  });

  it("matches a section and everything beneath it", () => {
    expect(isAdminRouteActive("/admin/claims", "/admin/claims")).toBe(true);
    expect(
      isAdminRouteActive("/admin/claims/3f2504e0-4f89-41d3-9a0c-0305e82c3301", "/admin/claims"),
    ).toBe(true);
    expect(
      isAdminRouteActive("/admin/claims/abc/documents", "/admin/claims"),
    ).toBe(true);
  });

  it("matches on a path segment, not on characters", () => {
    // `/admin/claimants` must not light `/admin/claims`.
    expect(isAdminRouteActive("/admin/claimants", "/admin/claims")).toBe(false);
    expect(isAdminRouteActive("/admin/intake-archive", "/admin/intake")).toBe(false);
  });
});
