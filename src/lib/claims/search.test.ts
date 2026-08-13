import { describe, expect, it } from "vitest";
import {
  applyClaimFilters,
  hasActiveFilters,
  parseClaimFilters,
  sanitiseSearch,
} from "./search";

describe("sanitiseSearch", () => {
  it("keeps ordinary search terms intact", () => {
    expect(sanitiseSearch("Windward Ct")).toBe("Windward Ct");
    expect(sanitiseSearch("CMG-2026-0001")).toBe("CMG-2026-0001");
    expect(sanitiseSearch("O Brien")).toBe("O Brien");
  });

  it("strips every character that has meaning in PostgREST's filter grammar", () => {
    // A comma ends one predicate and starts another; a paren closes the `or(…)`
    // group early. Left in, a search box is an injection point into the query's
    // own structure rather than into its values.
    for (const character of [",", "(", ")", "*", ".", '"', "'", "\\", ":"]) {
      expect(sanitiseSearch(`a${character}b`), `character ${character}`).toBe("a b");
    }
  });

  it("strips LIKE's own wildcards", () => {
    // A lone `%` would make every keystroke a full-table scan and would let a
    // search match rows it does not name.
    expect(sanitiseSearch("%")).toBe("");
    expect(sanitiseSearch("a%b_c")).toBe("a b c");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitiseSearch("  bell   road  ")).toBe("bell road");
  });

  it("caps the length so a filter cannot be made arbitrarily long", () => {
    expect(sanitiseSearch("x".repeat(500))).toHaveLength(80);
  });

  it("treats non-strings as no search", () => {
    expect(sanitiseSearch(null)).toBe("");
    expect(sanitiseSearch(undefined)).toBe("");
  });
});

describe("parseClaimFilters", () => {
  it("accepts a real status and rejects anything else", () => {
    expect(parseClaimFilters({ status: "filed" }).status).toBe("filed");
    expect(parseClaimFilters({ status: "banana" }).status).toBeNull();
    expect(parseClaimFilters({}).status).toBeNull();
  });

  it("accepts a uuid adjuster and the unassigned sentinel, nothing else", () => {
    const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(parseClaimFilters({ adjuster: uuid }).adjusterId).toBe(uuid);
    expect(parseClaimFilters({ adjuster: "unassigned" }).adjusterId).toBe("unassigned");
    // Anything that is not a uuid must not reach `.eq()` — an arbitrary string
    // there is a 400 from PostgREST, which is a different response shape and so
    // its own small oracle.
    expect(parseClaimFilters({ adjuster: "'; drop" }).adjusterId).toBeNull();
    expect(parseClaimFilters({ adjuster: "" }).adjusterId).toBeNull();
  });

  it("accepts a uuid partner and the direct sentinel", () => {
    const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(parseClaimFilters({ partner: uuid }).partnerId).toBe(uuid);
    expect(parseClaimFilters({ partner: "none" }).partnerId).toBe("none");
    expect(parseClaimFilters({ partner: "anything" }).partnerId).toBeNull();
  });

  it("sanitises the search term on the way in", () => {
    expect(parseClaimFilters({ q: "bell,evil.ilike.*" }).search).toBe("bell evil ilike");
  });
});

describe("hasActiveFilters", () => {
  it("is false for an untouched view", () => {
    expect(
      hasActiveFilters({
        status: null,
        adjusterId: null,
        partnerId: null,
        search: "",
      }),
    ).toBe(false);
  });

  it("is true when any one filter is set", () => {
    expect(
      hasActiveFilters({
        status: "filed",
        adjusterId: null,
        partnerId: null,
        search: "",
      }),
    ).toBe(true);
    expect(
      hasActiveFilters({
        status: null,
        adjusterId: null,
        partnerId: null,
        search: "bell",
      }),
    ).toBe(true);
  });
});

describe("applyClaimFilters", () => {
  it("applies the same parsed filters to list and count query builders", () => {
    const calls: string[] = [];
    const query = {
      eq(column: string, value: string) {
        calls.push(`eq:${column}:${value}`);
        return this;
      },
      is(column: string, value: null) {
        calls.push(`is:${column}:${value}`);
        return this;
      },
      ilike(column: string, pattern: string) {
        calls.push(`ilike:${column}:${pattern}`);
        return this;
      },
    };

    expect(
      applyClaimFilters(query, {
        status: "filed",
        adjusterId: "unassigned",
        partnerId: "partner-id",
        search: "Bell",
      }),
    ).toBe(query);
    expect(calls).toEqual([
      "eq:status:filed",
      "is:assigned_adjuster_id:null",
      "eq:partner_company_id:partner-id",
      "ilike:search_text:%Bell%",
    ]);
  });
});
