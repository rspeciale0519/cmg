import { describe, expect, it } from "vitest";
import {
  clampPage,
  firstParam,
  flipDirection,
  formatTimeCursor,
  isUuid,
  offsetBounds,
  offsetPageCount,
  pageSlice,
  parsePageNumber,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "./paging";

const ROW = {
  id: "30000000-0000-4000-a000-000000000007",
  created_at: "2026-08-10T13:04:11.482+00:00",
};

describe("isUuid", () => {
  it("accepts a canonical uuid in either case", () => {
    expect(isUuid(ROW.id)).toBe(true);
    expect(isUuid(ROW.id.toUpperCase())).toBe(true);
  });

  it("rejects anything that could close a PostgREST predicate", () => {
    // The whole reason this guard exists: `or=` is a grammar, and the route
    // segment reaches it by interpolation.
    expect(isUuid(`${ROW.id}),status.eq.new`)).toBe(false);
    expect(isUuid(`${ROW.id},id.eq.1`)).toBe(false);
    expect(isUuid("../../etc")).toBe(false);
  });

  it("rejects a uuid with the wrong shape, and non-strings", () => {
    expect(isUuid("30000000-0000-4000-a000-00000000000")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe("firstParam", () => {
  it("takes the first value when a key repeats", () => {
    expect(firstParam({ next: ["a", "b"] }, "next")).toBe("a");
    expect(firstParam({ next: "a" }, "next")).toBe("a");
    expect(firstParam({}, "next")).toBeUndefined();
  });
});

describe("parseTimeCursor", () => {
  it("round-trips a cursor built from a row", () => {
    expect(parseTimeCursor(formatTimeCursor(timeCursorFrom(ROW)))).toEqual({
      createdAt: ROW.created_at,
      id: ROW.id,
    });
  });

  it("drops a cursor whose timestamp is not an instant", () => {
    expect(parseTimeCursor(`yesterday~${ROW.id}`)).toBeNull();
  });

  it("drops a cursor whose tie-break is not a uuid", () => {
    expect(parseTimeCursor(`${ROW.created_at}~14`)).toBeNull();
  });

  it("drops a cursor carrying PostgREST grammar in either half", () => {
    expect(parseTimeCursor(`${ROW.created_at}~a),claim_id.eq.x`)).toBeNull();
    expect(parseTimeCursor(`2026-08-10T13:04:11+00:00,x~${ROW.id}`)).toBeNull();
  });

  it("drops an empty or separatorless cursor", () => {
    expect(parseTimeCursor(undefined)).toBeNull();
    expect(parseTimeCursor("")).toBeNull();
    expect(parseTimeCursor(ROW.id)).toBeNull();
    expect(parseTimeCursor(`~${ROW.id}`)).toBeNull();
  });
});

describe("timeKeysetClause", () => {
  it("opens backwards for a newest-first page", () => {
    expect(timeKeysetClause("desc", timeCursorFrom(ROW))).toBe(
      `created_at.lt.${ROW.created_at},` +
        `and(created_at.eq.${ROW.created_at},id.lt.${ROW.id})`,
    );
  });

  it("opens forwards when the reader pages back towards the newest", () => {
    expect(timeKeysetClause("asc", timeCursorFrom(ROW))).toBe(
      `created_at.gt.${ROW.created_at},` +
        `and(created_at.eq.${ROW.created_at},id.gt.${ROW.id})`,
    );
  });

  it("always pairs the tie-break, so two rows sharing a stamp cannot straddle a boundary", () => {
    expect(timeKeysetClause("desc", timeCursorFrom(ROW))).toContain("created_at.eq.");
  });
});

describe("flipDirection", () => {
  it("is its own inverse", () => {
    expect(flipDirection("asc")).toBe("desc");
    expect(flipDirection(flipDirection("asc"))).toBe("asc");
  });
});

describe("pageSlice", () => {
  const fetched = [1, 2, 3, 4];

  it("reports another page when the extra row came back, and drops it", () => {
    expect(pageSlice(fetched, 3, false)).toEqual({ rows: [1, 2, 3], hasMore: true });
  });

  it("reports the end of the list when it did not", () => {
    expect(pageSlice([1, 2], 3, false)).toEqual({ rows: [1, 2], hasMore: false });
  });

  it("turns a backwards-walked window around so the reader keeps their order", () => {
    expect(pageSlice(fetched, 3, true).rows).toEqual([3, 2, 1]);
  });

  it("leaves an empty page empty rather than inventing a row", () => {
    expect(pageSlice([], 3, false)).toEqual({ rows: [], hasMore: false });
  });
});

describe("parsePageNumber", () => {
  it("reads a whole page number", () => {
    expect(parsePageNumber("3")).toBe(3);
  });

  it("falls back to the first page for anything that is not one", () => {
    expect(parsePageNumber(undefined)).toBe(1);
    expect(parsePageNumber("")).toBe(1);
    expect(parsePageNumber("0")).toBe(1);
    expect(parsePageNumber("-2")).toBe(1);
    expect(parsePageNumber("two")).toBe(1);
    expect(parsePageNumber("1e400")).toBe(1);
  });
});

describe("offsetBounds", () => {
  it("starts the first page at zero", () => {
    expect(offsetBounds(1, 50)).toEqual({ from: 0, to: 49 });
  });

  it("leaves no gap and no overlap between consecutive pages", () => {
    const first = offsetBounds(1, 50);
    const second = offsetBounds(2, 50);
    expect(second.from).toBe(first.to + 1);
  });
});

describe("offsetPageCount", () => {
  it("counts a partial last page", () => {
    expect(offsetPageCount(51, 50)).toBe(2);
    expect(offsetPageCount(100, 50)).toBe(2);
  });

  it("calls an empty list one page rather than zero", () => {
    expect(offsetPageCount(0, 50)).toBe(1);
  });
});

describe("clampPage", () => {
  it("answers a stale bookmark with the last page that exists", () => {
    expect(clampPage(9, 51, 50)).toBe(2);
  });

  it("leaves a page that exists alone", () => {
    expect(clampPage(2, 51, 50)).toBe(2);
  });
});
