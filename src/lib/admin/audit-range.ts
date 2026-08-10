/**
 * Turning what the owner typed into what the query needs. Pure, because both
 * halves have an edge case that is invisible in a browser and wrong in a log.
 */

/**
 * The zone the workspace reports in — the same one `formatTimestamp` prints, so
 * a filter for "10 August" selects exactly the entries whose displayed stamp
 * reads 10 August. Anything else and the log disagrees with its own filter.
 */
const BUSINESS_TIME_ZONE = "America/New_York";

/**
 * The wall clock that `instant` shows in `timeZone`, expressed as if that clock
 * were UTC. The difference between this and the instant is the zone's offset at
 * that moment, which is the only way to get an offset that is right on both
 * sides of a daylight-saving change.
 */
function wallClockAsUtc(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // `hourCycle` is not set, so a midnight formatted with hour12:false comes back
  // as 24 rather than 0 in several engines. Left as 24 it rolls the date forward
  // a day and the whole offset calculation is out by 24 hours.
  const hour = read("hour") % 24;

  return Date.UTC(read("year"), read("month") - 1, read("day"), hour, read("minute"), read("second"));
}

/**
 * The instant at which a given wall-clock time occurs in a zone.
 *
 * Two passes, not one. The first pass measures the offset at the *wrong*
 * instant — the one you get by pretending the wall clock is UTC — which is off
 * by the offset itself, and lands on the wrong side of a DST boundary for any
 * time within a few hours of it. The second pass re-measures at the corrected
 * instant. Two passes converge for every real zone; a third would change nothing.
 */
function instantForWallClock(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): number {
  const naive = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstOffset = wallClockAsUtc(naive, timeZone) - naive;
  const corrected = naive - firstOffset;
  const secondOffset = wallClockAsUtc(corrected, timeZone) - corrected;
  return naive - secondOffset;
}

export type DayBounds = {
  /** Inclusive lower bound, as an ISO instant. */
  startIso: string;
  /** Exclusive upper bound — the first instant of the next day. */
  endIso: string;
};

/**
 * A calendar day in the business's zone, as a half-open instant range.
 *
 * Half-open rather than `23:59:59.999`, which is not the same thing: a
 * `timestamptz` holds microseconds, so an entry written at 23:59:59.9995 falls
 * outside an inclusive millisecond bound and disappears from the day it happened
 * on. In an audit trail that is a row nobody would ever notice was missing.
 */
export function dayBounds(date: string, timeZone = BUSINESS_TIME_ZONE): DayBounds | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const start = instantForWallClock(year, month, day, timeZone);
  // Date.UTC normalises 32 January into 1 February, so the next day needs no
  // month-length arithmetic of its own.
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const end = instantForWallClock(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    timeZone,
  );

  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() };
}

export type CursorInput<T> = {
  /** Ids on the page, already in display order (newest first). */
  readonly ids: readonly T[];
  /** Whether the query returned one more row than the page holds. */
  readonly hasMore: boolean;
  /** True when the page was walked forwards from an `after` cursor. */
  readonly ascending: boolean;
  /** False only on the newest page, where nothing newer can exist. */
  readonly cameFromCursor: boolean;
};

export type Cursors<T> = {
  /** Value for `?before=` — null at the end of the log. */
  olderThan: T | null;
  /** Value for `?after=` — null on the newest page. */
  newerThan: T | null;
};

/**
 * Which cursors a page can offer.
 *
 * The asymmetry is the whole of it: a descending page's extra row proves there
 * are *older* entries, and an ascending one's proves there are *newer* ones, so
 * `hasMore` establishes a different fact depending on which way the reader is
 * travelling. Getting it backwards produces a "Newer" link on the newest page —
 * one click to an empty screen, from a log the owner is meant to trust.
 *
 * Generic in the cursor's type because the rule is about direction of travel,
 * not about what a cursor is made of: the audit log pages on an integer
 * identity, and the claims list pages on a `(sort value, claim_ref)` pair.
 */
export function pageCursors<T>({
  ids,
  hasMore,
  ascending,
  cameFromCursor,
}: CursorInput<T>): Cursors<T> {
  const newest = ids[0] ?? null;
  const oldest = ids[ids.length - 1] ?? null;

  if (ascending) {
    // Walked forwards from an older page, so older entries certainly exist.
    return { olderThan: oldest, newerThan: hasMore ? newest : null };
  }

  return {
    olderThan: hasMore ? oldest : null,
    newerThan: cameFromCursor ? newest : null,
  };
}
