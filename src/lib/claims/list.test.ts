import { describe, expect, it } from "vitest";
import {
  columnSortState,
  cursorFrom,
  DEFAULT_CLAIM_SORT,
  flipDirection,
  formatClaimCursor,
  keysetClause,
  parseClaimCursor,
  parseClaimSort,
  sortActionLabel,
  toggledSort,
} from "./list";

const ROW = {
  claim_ref: "CMG-2026-0042",
  status: "filed",
  loss_date: "2026-03-14",
  updated_at: "2026-08-10T18:22:31.145926+00:00",
};

describe("parseClaimSort", () => {
  it("falls back to newest-updated for an unknown column", () => {
    expect(parseClaimSort("carrier", "asc")).toEqual(DEFAULT_CLAIM_SORT);
    expect(parseClaimSort(undefined, undefined)).toEqual(DEFAULT_CLAIM_SORT);
  });

  it("uses the column's own opening direction when none is given", () => {
    expect(parseClaimSort("ref", undefined)).toEqual({ key: "ref", direction: "asc" });
    expect(parseClaimSort("loss", undefined)).toEqual({ key: "loss", direction: "desc" });
  });

  it("ignores a direction that is not asc or desc", () => {
    expect(parseClaimSort("ref", "sideways")).toEqual({ key: "ref", direction: "asc" });
  });
});

describe("toggledSort", () => {
  it("opens a new column in its own direction rather than ascending", () => {
    const current = { key: "ref", direction: "asc" } as const;
    expect(toggledSort(current, "updated")).toEqual({ key: "updated", direction: "desc" });
  });

  it("reverses the column that is already sorted", () => {
    const current = { key: "updated", direction: "desc" } as const;
    expect(toggledSort(current, "updated")).toEqual({ key: "updated", direction: "asc" });
  });
});

describe("columnSortState", () => {
  it("reports none for every column but the sorted one", () => {
    const current = { key: "loss", direction: "asc" } as const;
    expect(columnSortState(current, "loss")).toBe("asc");
    expect(columnSortState(current, "ref")).toBe("none");
  });
});

describe("sortActionLabel", () => {
  it("names the effect rather than the direction word", () => {
    expect(sortActionLabel(DEFAULT_CLAIM_SORT, "loss")).toBe(
      "Sort by loss date, newest first",
    );
    expect(sortActionLabel({ key: "loss", direction: "desc" }, "loss")).toBe(
      "Sort by loss date, oldest first",
    );
  });
});

describe("parseClaimCursor", () => {
  it("round-trips a cursor built from a row", () => {
    for (const key of ["ref", "status", "loss", "updated"] as const) {
      const cursor = cursorFrom(key, ROW);
      expect(parseClaimCursor(key, formatClaimCursor(cursor))).toEqual(cursor);
    }
  });

  it("refuses a value whose shape does not match its column", () => {
    expect(parseClaimCursor("loss", "2026-08-10T18:22:31Z~CMG-2026-0042")).toBeNull();
    expect(parseClaimCursor("status", "not_a_status~CMG-2026-0042")).toBeNull();
    expect(parseClaimCursor("updated", "2026-03-14~CMG-2026-0042")).toBeNull();
    expect(parseClaimCursor("ref", "CMG-26-1~CMG-2026-0042")).toBeNull();
  });

  it("refuses a tie-break that is not a claim reference", () => {
    expect(parseClaimCursor("loss", "2026-03-14~'); drop table claims;--")).toBeNull();
    expect(parseClaimCursor("loss", "2026-03-14~")).toBeNull();
  });

  it("refuses PostgREST grammar smuggled into either half", () => {
    // A comma would end the predicate and start another; a parenthesis would
    // close the or() group early. Neither shape can carry one.
    expect(parseClaimCursor("status", "filed,id.not.is.null~CMG-2026-0042")).toBeNull();
    expect(parseClaimCursor("loss", "2026-03-14)~CMG-2026-0042")).toBeNull();
    expect(parseClaimCursor("updated", "2026-08-10T18:22:31Z~CMG-2026-0042)")).toBeNull();
  });

  it("is null for a missing or malformed cursor", () => {
    expect(parseClaimCursor("updated", undefined)).toBeNull();
    expect(parseClaimCursor("updated", "")).toBeNull();
    expect(parseClaimCursor("updated", "~CMG-2026-0042")).toBeNull();
    expect(parseClaimCursor("updated", "no-separator")).toBeNull();
  });
});

describe("keysetClause", () => {
  it("pairs the sort column with the reference so a tie cannot drop a row", () => {
    const cursor = cursorFrom("updated", ROW);
    expect(keysetClause("updated", "desc", cursor)).toBe(
      "updated_at.lt.2026-08-10T18:22:31.145926+00:00," +
        "and(updated_at.eq.2026-08-10T18:22:31.145926+00:00,claim_ref.lt.CMG-2026-0042)",
    );
  });

  it("flips both comparisons when walking the other way", () => {
    const cursor = cursorFrom("loss", ROW);
    expect(keysetClause("loss", "asc", cursor)).toBe(
      "loss_date.gt.2026-03-14,and(loss_date.eq.2026-03-14,claim_ref.gt.CMG-2026-0042)",
    );
  });

  it("needs no pair when the sort column is already unique", () => {
    expect(keysetClause("ref", "asc", cursorFrom("ref", ROW))).toBe(
      "claim_ref.gt.CMG-2026-0042",
    );
  });
});

describe("flipDirection", () => {
  it("is its own inverse", () => {
    expect(flipDirection(flipDirection("asc"))).toBe("asc");
    expect(flipDirection("desc")).toBe("asc");
  });
});
