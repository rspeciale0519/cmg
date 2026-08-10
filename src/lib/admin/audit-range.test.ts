import { describe, expect, it } from "vitest";
import { dayBounds, pageCursors } from "./audit-range";

describe("dayBounds", () => {
  it("starts a summer day at 04:00Z — midnight in Orlando on EDT", () => {
    expect(dayBounds("2026-08-10")).toEqual({
      startIso: "2026-08-10T04:00:00.000Z",
      endIso: "2026-08-11T04:00:00.000Z",
    });
  });

  it("starts a winter day at 05:00Z — midnight on EST", () => {
    // The bug a fixed `-04:00` offset would ship: a January filter would begin
    // an hour early and quietly include the tail of the previous day.
    expect(dayBounds("2026-01-15")).toEqual({
      startIso: "2026-01-15T05:00:00.000Z",
      endIso: "2026-01-16T05:00:00.000Z",
    });
  });

  it("handles the spring-forward day, which is 23 hours long", () => {
    // 8 March 2026, 02:00 EST → 03:00 EDT. The day starts on EST and ends on
    // EDT, so a naive single-offset calculation is wrong at one end whichever
    // offset it picks.
    const bounds = dayBounds("2026-03-08");
    expect(bounds).toEqual({
      startIso: "2026-03-08T05:00:00.000Z",
      endIso: "2026-03-09T04:00:00.000Z",
    });

    const hours =
      (Date.parse(bounds!.endIso) - Date.parse(bounds!.startIso)) / 3_600_000;
    expect(hours).toBe(23);
  });

  it("handles the fall-back day, which is 25 hours long", () => {
    const bounds = dayBounds("2026-11-01");
    const hours =
      (Date.parse(bounds!.endIso) - Date.parse(bounds!.startIso)) / 3_600_000;
    expect(hours).toBe(25);
  });

  it("rolls over month and year ends without arithmetic of its own", () => {
    expect(dayBounds("2026-01-31")?.endIso).toBe("2026-02-01T05:00:00.000Z");
    expect(dayBounds("2026-12-31")?.endIso).toBe("2027-01-01T05:00:00.000Z");
    expect(dayBounds("2028-02-28")?.endIso).toBe("2028-02-29T05:00:00.000Z");
  });

  it("is half-open, so the upper bound is the next day's first instant", () => {
    // Not 23:59:59.999. A timestamptz holds microseconds, so an entry written
    // at .9995 falls outside an inclusive millisecond bound and vanishes from
    // the day it happened on.
    const day = dayBounds("2026-08-10");
    const next = dayBounds("2026-08-11");
    expect(day?.endIso).toBe(next?.startIso);
  });

  it("refuses anything that is not a calendar date", () => {
    expect(dayBounds("")).toBeNull();
    expect(dayBounds("2026-8-1")).toBeNull();
    expect(dayBounds("10/08/2026")).toBeNull();
    expect(dayBounds("2026-13-01")).toBeNull();
    expect(dayBounds("2026-08-32")).toBeNull();
    expect(dayBounds("' or 1=1--")).toBeNull();
  });
});

describe("pageCursors", () => {
  const ids = [120, 119, 118];

  it("offers only Older on the newest page", () => {
    expect(
      pageCursors({ ids, hasMore: true, ascending: false, cameFromCursor: false }),
    ).toEqual({ olderThan: 118, newerThan: null });
  });

  it("offers nothing when the newest page is also the whole log", () => {
    expect(
      pageCursors({ ids, hasMore: false, ascending: false, cameFromCursor: false }),
    ).toEqual({ olderThan: null, newerThan: null });
  });

  it("offers both directions in the middle of the log", () => {
    expect(
      pageCursors({ ids, hasMore: true, ascending: false, cameFromCursor: true }),
    ).toEqual({ olderThan: 118, newerThan: 120 });
  });

  it("drops Older on the last page but keeps Newer", () => {
    expect(
      pageCursors({ ids, hasMore: false, ascending: false, cameFromCursor: true }),
    ).toEqual({ olderThan: null, newerThan: 120 });
  });

  it("reads hasMore as 'newer exists' when walking forwards", () => {
    // The asymmetry the whole function exists for: an ascending page's extra row
    // proves there are newer entries, a descending one's proves there are older.
    expect(
      pageCursors({ ids, hasMore: true, ascending: true, cameFromCursor: true }),
    ).toEqual({ olderThan: 118, newerThan: 120 });
  });

  it("drops Newer when walking forwards lands on the newest page", () => {
    // Without this, the newest page carries a Newer link straight to an empty
    // screen — in a log the owner is meant to trust.
    expect(
      pageCursors({ ids, hasMore: false, ascending: true, cameFromCursor: true }),
    ).toEqual({ olderThan: 118, newerThan: null });
  });

  it("offers no cursors for an empty page", () => {
    expect(
      pageCursors({ ids: [], hasMore: false, ascending: false, cameFromCursor: true }),
    ).toEqual({ olderThan: null, newerThan: null });
  });

  it("uses the page's own ends, not the full result window", () => {
    expect(
      pageCursors({ ids: [9], hasMore: true, ascending: false, cameFromCursor: true }),
    ).toEqual({ olderThan: 9, newerThan: 9 });
  });
});
