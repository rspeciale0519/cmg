import { describe, expect, it } from "vitest";
import {
  formatAddressLine,
  formatDateOnly,
  formatMoney,
  formatPercent,
  formatRelative,
  formatTimeOnly,
  humanizeEnum,
  initialsFor,
} from "./format";

describe("formatDateOnly", () => {
  it("renders a Postgres date as the calendar day it is", () => {
    expect(formatDateOnly("2026-03-14")).toBe("Mar 14, 2026");
  });

  it("does not shift the day for readers west of UTC", () => {
    // The bug this pins: `new Date("2026-01-01")` is midnight *UTC*, so any
    // local-time formatter prints 31 December for everyone at CMG, in Orlando,
    // at UTC-4 or -5. A date of loss that moves by a day is the field a carrier
    // uses to test the claim against the policy period.
    expect(formatDateOnly("2026-01-01")).toBe("Jan 1, 2026");
    expect(formatDateOnly("2026-12-31")).toBe("Dec 31, 2026");
  });

  it("tolerates a full timestamp in the column", () => {
    expect(formatDateOnly("2026-03-14T00:00:00Z")).toBe("Mar 14, 2026");
  });

  it("renders an em dash for nothing", () => {
    expect(formatDateOnly(null)).toBe("—");
    expect(formatDateOnly("")).toBe("—");
    expect(formatDateOnly("not a date")).toBe("—");
    expect(formatDateOnly("2026-13-01")).toBe("—");
  });
});

describe("formatTimeOnly", () => {
  it("renders a Postgres time in 12-hour form", () => {
    expect(formatTimeOnly("14:30:00")).toBe("2:30 PM");
    expect(formatTimeOnly("09:05:00")).toBe("9:05 AM");
  });

  it("renders both ends of the clock without a zero hour", () => {
    expect(formatTimeOnly("00:00:00")).toBe("12:00 AM");
    expect(formatTimeOnly("12:00:00")).toBe("12:00 PM");
  });

  it("renders an em dash for nothing", () => {
    expect(formatTimeOnly(null)).toBe("—");
    expect(formatTimeOnly("nope")).toBe("—");
  });
});

describe("formatMoney", () => {
  it("drops cents on a round figure and keeps them otherwise", () => {
    expect(formatMoney(86000)).toBe("$86,000");
    expect(formatMoney(86000.5)).toBe("$86,000.50");
  });

  it("renders zero as a figure, not as absent", () => {
    // A settlement of $0 is a real outcome and must not read as "not recorded".
    expect(formatMoney(0)).toBe("$0");
  });

  it("accepts the numeric-as-string PostgREST returns", () => {
    expect(formatMoney("12500.00")).toBe("$12,500");
  });

  it("renders an em dash for nothing", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
    expect(formatMoney("abc")).toBe("—");
  });
});

describe("formatPercent", () => {
  it("keeps a whole number whole", () => {
    expect(formatPercent(10)).toBe("10%");
    expect(formatPercent("10.00")).toBe("10%");
  });

  it("keeps two places when they carry information", () => {
    expect(formatPercent(12.5)).toBe("12.50%");
  });

  it("renders zero rather than an em dash", () => {
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-08-10T12:00:00Z");

  it("reports recency in the unit a queue is read in", () => {
    expect(formatRelative("2026-08-10T11:59:40Z", now)).toBe("just now");
    expect(formatRelative("2026-08-10T11:30:00Z", now)).toBe("30m ago");
    expect(formatRelative("2026-08-10T06:00:00Z", now)).toBe("6h ago");
    expect(formatRelative("2026-08-07T12:00:00Z", now)).toBe("3d ago");
  });

  it("falls back to a date past a fortnight", () => {
    // "47 days ago" is arithmetic the reader has to undo.
    expect(formatRelative("2026-06-01T12:00:00Z", now)).toBe("Jun 1, 2026");
  });

  it("renders an em dash for nothing", () => {
    expect(formatRelative(null, now)).toBe("—");
    expect(formatRelative("garbage", now)).toBe("—");
  });
});

describe("humanizeEnum", () => {
  it("uses the written-out form where one exists", () => {
    expect(humanizeEnum("wind_hail")).toBe("Wind & hail");
    expect(humanizeEnum("lt_1_year")).toBe("Under 1 year");
    expect(humanizeEnum("paid_no_repairs")).toBe("Paid, no repairs made");
  });

  it("sentence-cases anything unlisted rather than printing the enum", () => {
    expect(humanizeEnum("hurricane")).toBe("Hurricane");
    expect(humanizeEnum("some_new_value")).toBe("Some new value");
  });

  it("renders an em dash for nothing", () => {
    expect(humanizeEnum(null)).toBe("—");
    expect(humanizeEnum("")).toBe("—");
  });
});

describe("formatAddressLine", () => {
  it("joins a single-line address", () => {
    expect(
      formatAddressLine({
        street: "118 Windward Ct",
        city: "Winter Park",
        state: "Florida",
        zip: "32789",
      }),
    ).toBe("118 Windward Ct, Winter Park, Florida 32789");
  });

  it("folds in a second street line when present", () => {
    expect(
      formatAddressLine({
        street: "118 Windward Ct",
        street2: "Unit 4",
        city: "Winter Park",
        state: "Florida",
        zip: "32789",
      }),
    ).toBe("118 Windward Ct, Unit 4, Winter Park, Florida 32789");
  });
});

describe("initialsFor", () => {
  it("takes the first and last initial", () => {
    expect(initialsFor("Marcus Bell")).toBe("MB");
    expect(initialsFor("Mary Anne Van Der Berg")).toBe("MB");
  });

  it("takes two letters from a single name", () => {
    expect(initialsFor("Prince")).toBe("PR");
  });

  it("renders an em dash for nothing", () => {
    expect(initialsFor(null)).toBe("—");
    expect(initialsFor("   ")).toBe("—");
  });
});
