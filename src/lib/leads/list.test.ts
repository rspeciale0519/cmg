import { describe, expect, it } from "vitest";
import {
  formatLeadCursor,
  leadCursorFrom,
  leadKeysetClause,
  parseLeadCursor,
} from "./list";

const ROW = {
  id: "90000000-0000-4000-a000-000000000001",
  created_at: "2026-08-05T23:22:00+00:00",
};

describe("parseLeadCursor", () => {
  it("round-trips a cursor built from a row", () => {
    expect(parseLeadCursor(formatLeadCursor(leadCursorFrom(ROW)))).toEqual({
      createdAt: ROW.created_at,
      id: ROW.id,
    });
  });

  it("drops a cursor whose timestamp is not an instant", () => {
    expect(parseLeadCursor(`yesterday~${ROW.id}`)).toBeNull();
  });

  it("drops a cursor whose tie-break is not a uuid", () => {
    expect(parseLeadCursor(`${ROW.created_at}~14`)).toBeNull();
  });

  it("drops a cursor carrying PostgREST grammar", () => {
    // The half that reaches `or=` unescaped. A value that could close a
    // predicate must not survive parsing.
    expect(parseLeadCursor(`${ROW.created_at}~a),status.eq.new`)).toBeNull();
    expect(parseLeadCursor(`2026-08-05T23:22:00+00:00,x~${ROW.id}`)).toBeNull();
  });

  it("drops an empty or separatorless cursor", () => {
    expect(parseLeadCursor(undefined)).toBeNull();
    expect(parseLeadCursor("")).toBeNull();
    expect(parseLeadCursor(ROW.id)).toBeNull();
    expect(parseLeadCursor(`~${ROW.id}`)).toBeNull();
  });

  it("splits on the last separator, so a stamp holding one cannot shift the key", () => {
    expect(parseLeadCursor(`${ROW.created_at}~${ROW.id}`)?.id).toBe(ROW.id);
  });
});

describe("leadKeysetClause", () => {
  it("opens backwards for the newest-first page", () => {
    expect(leadKeysetClause("desc", leadCursorFrom(ROW))).toBe(
      `created_at.lt.${ROW.created_at},` +
        `and(created_at.eq.${ROW.created_at},id.lt.${ROW.id})`,
    );
  });

  it("opens forwards when the reader pages back towards the newest", () => {
    expect(leadKeysetClause("asc", leadCursorFrom(ROW))).toBe(
      `created_at.gt.${ROW.created_at},` +
        `and(created_at.eq.${ROW.created_at},id.gt.${ROW.id})`,
    );
  });

  it("always pairs the tie-break, so two leads sharing a stamp cannot straddle a page boundary", () => {
    // The whole reason the cursor is a pair: `now()` is transaction start time,
    // so a bare `created_at.lt.` would drop whichever tied row sat on the edge.
    expect(leadKeysetClause("desc", leadCursorFrom(ROW))).toContain("created_at.eq.");
  });
});
