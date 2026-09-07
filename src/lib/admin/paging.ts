/**
 * Paging primitives shared by every list in the workspace. Pure, so the parts
 * that are easy to get subtly wrong — what a cursor is allowed to contain,
 * which way a predicate opens, where a page starts — are unit-tested rather
 * than eyeballed.
 *
 * Two mechanisms live here because the lists divide into two kinds, and using
 * one mechanism for both would be wrong for one of them:
 *
 *   * **Keyset**, for a list ordered by the column new rows land at the top of
 *     — activity, documents, status history, attributed claims, the intake
 *     queue. `offset 40 * n` re-walks every skipped row, and it is *wrong* as
 *     well as slow here: one event posted while the reader is on page 1 shifts
 *     every later row down by one, and the row that was first on page 2 is
 *     silently skipped. A cursor describes a position in the data rather than a
 *     count of rows, so it survives the list moving underneath the reader.
 *
 *   * **Offset**, for a directory ordered alphabetically — partner companies,
 *     staff accounts, a company's reps — and for a list ordered oldest-first,
 *     where new rows append to the end. Neither shifts the rows already on
 *     screen, so offset's failure mode cannot occur; and a name is arbitrary
 *     text, which means it cannot be interpolated into PostgREST's `or=`
 *     grammar the way a timestamp or a uuid can. Choosing keyset there would
 *     mean escaping user-supplied text into a grammar to buy a property the
 *     ordering already has.
 *
 * Why a keyset cursor is a *pair*, the reasoning `src/lib/claims/list.ts` sets
 * out in full: `created_at` defaults to `now()`, which is transaction *start*
 * time, so two rows written in one transaction — or two seeded rows given the
 * same stamp — hold identical values, and a bare `created_at < cursor` drops
 * whichever of them sat on the page boundary. The primary key is `not null`,
 * unique and never reused, which makes `(created_at, id)` a total order. It is
 * a random uuid and therefore not a *meaningful* tie-break, but a tie-break
 * only has to be stable, and it is the only unique column these tables have —
 * `claim_ref`'s equivalent does not exist on `claim_events` or `documents`.
 */

export type PageDirection = "asc" | "desc";

/**
 * `~` separates the two halves. It appears in neither an ISO instant nor a
 * uuid, so the split is unambiguous without escaping.
 */
const CURSOR_SEPARATOR = "~";

const INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:?\d{2}|Z)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A uuid, and nothing that is merely uuid-shaped-enough to pass.
 *
 * This is the guard a route segment goes through before it reaches a PostgREST
 * `or=` string. That grammar is interpolated rather than parameterised, so a
 * value carrying a comma or a parenthesis would end one predicate and begin
 * another; a uuid can hold neither.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** The first value for a key, since a query string may repeat one. */
export function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

export type TimeCursor = {
  /** The boundary row's `created_at`, as PostgREST returned it. */
  createdAt: string;
  /** That row's primary key, breaking the tie. */
  id: string;
};

/**
 * A cursor arrives from the URL and is interpolated into PostgREST's `or=`
 * grammar — which is a grammar, not a parameter list. So each half is validated
 * against the shape its column can actually hold rather than escaped: neither
 * an ISO instant nor a uuid can contain the comma or parenthesis that would end
 * a predicate early.
 *
 * An unparseable cursor is dropped rather than rejected — a stale bookmark
 * should show the first page, not an error.
 */
export function parseTimeCursor(raw: string | undefined): TimeCursor | null {
  if (!raw) return null;

  const split = raw.lastIndexOf(CURSOR_SEPARATOR);
  if (split <= 0) return null;

  const createdAt = raw.slice(0, split);
  const id = raw.slice(split + 1);

  if (!INSTANT.test(createdAt) || !UUID.test(id)) return null;

  return { createdAt, id };
}

export function formatTimeCursor(cursor: TimeCursor): string {
  return `${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.id}`;
}

export function timeCursorFrom(row: { id: string; created_at: string }): TimeCursor {
  return { createdAt: row.created_at, id: row.id };
}

/**
 * The `or=` predicate for "strictly past this row, in this direction".
 *
 * `(created_at, id) < (v, r)` has no row-value form in PostgREST, so it is
 * written out: either the timestamp is already past `v`, or it equals `v` and
 * the key is past `r`.
 */
export function timeKeysetClause(
  direction: PageDirection,
  cursor: TimeCursor,
): string {
  const op = direction === "asc" ? "gt" : "lt";
  return (
    `created_at.${op}.${cursor.createdAt},` +
    `and(created_at.eq.${cursor.createdAt},id.${op}.${cursor.id})`
  );
}

export function flipDirection(direction: PageDirection): PageDirection {
  return direction === "asc" ? "desc" : "asc";
}

export type PageSlice<T> = {
  /** The rows to render, in the reader's order. */
  rows: T[];
  /** Whether the query returned one more row than the page holds. */
  hasMore: boolean;
};

/**
 * The page, from a fetch of `size + 1` rows. The extra row's presence is what
 * says there is another page, without a second count query; `reversed` is true
 * when the reader paged backwards, which means the window was walked the
 * opposite way and has to be turned around before it is read.
 */
export function pageSlice<T>(
  fetched: readonly T[],
  size: number,
  reversed: boolean,
): PageSlice<T> {
  const hasMore = fetched.length > size;
  const window = fetched.slice(0, size);
  return { rows: reversed ? [...window].reverse() : window, hasMore };
}

/**
 * A 1-based page number from the URL. Anything that is not a whole page — zero,
 * a negative, a word, a float — is the first page, for the same reason an
 * unparseable cursor is: a stale link should show the list.
 */
export function parsePageNumber(raw: string | undefined): number {
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export type OffsetBounds = {
  /** Zero-based index of the first row on the page. */
  from: number;
  /** Zero-based index of the last row PostgREST should return. */
  to: number;
};

export function offsetBounds(page: number, size: number): OffsetBounds {
  const from = (page - 1) * size;
  return { from, to: from + size - 1 };
}

/** How many pages `total` rows fill. Zero rows is still one (empty) page. */
export function offsetPageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * The page a reader should actually be shown, given how many there are. Asking
 * for page 9 of a 3-page list is a stale bookmark, and answering it with an
 * empty panel under a header that counts 42 rows is the same lie this whole
 * pass exists to remove.
 */
export function clampPage(page: number, total: number, size: number): number {
  return Math.min(page, offsetPageCount(total, size));
}
