import { isClaimStatus } from "./status";

/**
 * Ordering and paging for the claims list. Pure, so the parts that are easy to
 * get subtly wrong — which direction a column opens in, what a cursor is
 * allowed to contain — are unit-tested rather than eyeballed.
 *
 * Why keyset and not `offset`: the same reason `/admin/audit` gives. `offset
 * 60 * n` re-walks every skipped row, and it is *wrong* as well as slow on a
 * list that is ordered by `updated_at` — the thing an adjuster changes while
 * reading it. Touch a claim on page 1 and it jumps to the top, which shifts
 * every later row down by one, and the claim that was first on page 2 is now
 * last on page 1: it is silently skipped. A cursor describes a position in the
 * data rather than a count of rows, so it survives the list moving underneath
 * the reader.
 *
 * Why the cursor carries `claim_ref` as well as the sort value: `audit_log`
 * keys on its primary key because `created_at` defaults to `now()`, which is
 * transaction *start* time and therefore ties — and a `<` cursor on a tied
 * value drops whichever row sat on the page boundary. Every sort column
 * offered here ties far more readily than that: two claims can share a status,
 * a loss date, or an `updated_at` (one transaction touching two claims stamps
 * both with the same `now()`). Claims' own primary key is a random uuid, so it
 * is a tie-break but not a *meaningful* one; `claim_ref` is `not null unique`
 * with a checked shape, which makes `(sort column, claim_ref)` a total order
 * and makes the tie-break reproduce the reference order a reader expects.
 */

export const CLAIMS_PAGE_SIZE = 60;

export type ClaimSortKey = "ref" | "status" | "loss" | "updated";
export type SortDirection = "asc" | "desc";
export type ClaimSort = { key: ClaimSortKey; direction: SortDirection };

export const CLAIM_SORT_COLUMN = {
  ref: "claim_ref",
  status: "status",
  loss: "loss_date",
  updated: "updated_at",
} as const satisfies Record<ClaimSortKey, string>;

/** `not null unique` on `public.claims`, so it totally orders any tie. */
export const CLAIM_TIE_BREAK = "claim_ref";

export const DEFAULT_CLAIM_SORT: ClaimSort = { key: "updated", direction: "desc" };

/**
 * The direction a column starts in when it is first clicked — not "always
 * ascending". A reader clicking "Updated" wants the most recent work, and a
 * reader clicking "Loss date" wants the most recent loss; both would have to
 * click twice to get there under a uniform rule. Reference and Status open
 * ascending because their ascending order is the one that means something:
 * reference order is chronological by issue, and status order is the pipeline.
 */
const OPENING_DIRECTION: Record<ClaimSortKey, SortDirection> = {
  ref: "asc",
  status: "asc",
  loss: "desc",
  updated: "desc",
};

export const SORT_LABEL: Record<ClaimSortKey, string> = {
  ref: "reference",
  status: "status",
  loss: "loss date",
  updated: "last updated",
};

/**
 * What each direction means in words, per column. "Ascending" is a fact about
 * the query; "oldest first" is a fact about the list, and it is the one an
 * `aria-label` should carry.
 */
const DIRECTION_PHRASE: Record<ClaimSortKey, Record<SortDirection, string>> = {
  ref: { asc: "lowest first", desc: "highest first" },
  status: { asc: "earliest stage first", desc: "latest stage first" },
  loss: { asc: "oldest first", desc: "newest first" },
  updated: { asc: "least recent first", desc: "most recent first" },
};

function isSortKey(value: unknown): value is ClaimSortKey {
  return (
    value === "ref" || value === "status" || value === "loss" || value === "updated"
  );
}

export function parseClaimSort(
  sort: string | undefined,
  direction: string | undefined,
): ClaimSort {
  if (!isSortKey(sort)) return DEFAULT_CLAIM_SORT;
  return {
    key: sort,
    direction: direction === "asc" || direction === "desc"
      ? direction
      : OPENING_DIRECTION[sort],
  };
}

/** What clicking this column's header should produce, given the current sort. */
export function toggledSort(current: ClaimSort, column: ClaimSortKey): ClaimSort {
  if (current.key !== column) {
    return { key: column, direction: OPENING_DIRECTION[column] };
  }
  return {
    key: column,
    direction: current.direction === "asc" ? "desc" : "asc",
  };
}

export function columnSortState(
  current: ClaimSort,
  column: ClaimSortKey,
): "none" | "asc" | "desc" {
  return current.key === column ? current.direction : "none";
}

/** The sentence a screen reader gets on the header link. */
export function sortActionLabel(current: ClaimSort, column: ClaimSortKey): string {
  const next = toggledSort(current, column);
  return `Sort by ${SORT_LABEL[column]}, ${DIRECTION_PHRASE[column][next.direction]}`;
}

export type ClaimCursor = {
  /** The sort column's value on the boundary row. */
  value: string;
  /** That row's `claim_ref`, breaking the tie. */
  ref: string;
};

/**
 * `~` separates the two halves. It appears in none of the four value shapes —
 * a checked `CMG-YYYY-NNNN`, an ISO date, an ISO instant, or a `claim_status`
 * enum label — so the split is unambiguous without escaping.
 */
const CURSOR_SEPARATOR = "~";

const CLAIM_REF = /^CMG-\d{4}-\d{4}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:?\d{2}|Z)?$/;

/**
 * A cursor arrives from the URL, and it is interpolated into PostgREST's `or=`
 * grammar — which is a grammar, not a parameter list, exactly as
 * `sanitiseSearch` documents for the search box. So each half is validated
 * against the shape its column can actually hold rather than escaped: a value
 * that is not a claim reference, an ISO date, an ISO instant or a known status
 * is not a cursor at all, and none of those four shapes can contain the comma
 * or parenthesis that would end a predicate early.
 *
 * An unparseable cursor is dropped rather than rejected — a stale bookmark
 * should show the first page of claims, not an error.
 */
export function parseClaimCursor(
  key: ClaimSortKey,
  raw: string | undefined,
): ClaimCursor | null {
  if (!raw) return null;

  const split = raw.lastIndexOf(CURSOR_SEPARATOR);
  if (split <= 0) return null;

  const value = raw.slice(0, split);
  const ref = raw.slice(split + 1);

  if (!CLAIM_REF.test(ref)) return null;

  const valid =
    key === "ref"
      ? CLAIM_REF.test(value)
      : key === "loss"
        ? DATE_ONLY.test(value)
        : key === "updated"
          ? INSTANT.test(value)
          : isClaimStatus(value);

  return valid ? { value, ref } : null;
}

export function formatClaimCursor(cursor: ClaimCursor): string {
  return `${cursor.value}${CURSOR_SEPARATOR}${cursor.ref}`;
}

export function cursorFrom(
  key: ClaimSortKey,
  row: { claim_ref: string; status: string; loss_date: string; updated_at: string },
): ClaimCursor {
  const value =
    key === "ref"
      ? row.claim_ref
      : key === "status"
        ? row.status
        : key === "loss"
          ? row.loss_date
          : row.updated_at;

  return { value, ref: row.claim_ref };
}

/**
 * The `or=` predicate for "strictly past this row, in this direction".
 *
 * `(column, claim_ref) > (v, r)` has no row-value form in PostgREST, so it is
 * written out: either the column is already past `v`, or it equals `v` and the
 * reference is past `r`. Sorting on the reference itself needs no pair —
 * `claim_ref` is unique, so it never ties with itself.
 */
export function keysetClause(
  key: ClaimSortKey,
  direction: SortDirection,
  cursor: ClaimCursor,
): string {
  const column = CLAIM_SORT_COLUMN[key];
  const op = direction === "asc" ? "gt" : "lt";

  if (key === "ref") return `${CLAIM_TIE_BREAK}.${op}.${cursor.ref}`;

  return (
    `${column}.${op}.${cursor.value},` +
    `and(${column}.eq.${cursor.value},${CLAIM_TIE_BREAK}.${op}.${cursor.ref})`
  );
}

export function flipDirection(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc";
}
