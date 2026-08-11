/**
 * Paging for the leads inbox. Pure, so the two things that are easy to get
 * subtly wrong — what a cursor is allowed to contain, and which way the
 * predicate opens — are unit-tested rather than eyeballed.
 *
 * Why keyset and not `limit(80)`: the list was capped at eighty rows under a
 * header that counted every lead in the business, with no pager, no "showing N
 * of M" and no notice. Past eighty enquiries the page stated a true total over
 * an untrue list and the remainder was unreachable by any gesture — the same
 * defect `/admin/claims` and `/admin/audit` were fixed for, on the one surface
 * that was missed. A lead is a phone number somebody is waiting on, so the rows
 * that fall off the end are the oldest unanswered ones.
 *
 * Why the cursor carries `id` as well as `created_at`, the same reasoning
 * `src/lib/claims/list.ts` sets out: `created_at` defaults to `now()`, which is
 * transaction *start* time, so two leads written in one transaction — or two
 * seeded rows given the same stamp — hold identical values, and a bare
 * `created_at < cursor` drops whichever of them sat on the page boundary. That
 * is a missed callback nobody would ever notice. `leads.id` is the primary key:
 * `not null`, unique, and never reused, which makes `(created_at, id)` a total
 * order. It is a random uuid and therefore not a *meaningful* tie-break, but a
 * tie-break only has to be stable, and this is the only unique column the table
 * has — `claim_ref`'s equivalent does not exist here.
 *
 * Why not `offset`: `offset 40 * n` re-walks every skipped row, and it is wrong
 * as well as slow on a list ordered by a column new rows land at the top of —
 * one enquiry arriving while the operator reads page 1 shifts every later row
 * down by one, and the lead that was first on page 2 is silently skipped.
 */

/**
 * Forty, matching `/admin/audit` rather than the claims table's sixty. A lead is
 * a heading, two contact links and a paragraph — roughly four times a claim
 * row's height — so sixty of them is a page nobody reaches the bottom of.
 */
export const LEADS_PAGE_SIZE = 40;

export type LeadCursor = {
  /** The boundary row's `created_at`, as PostgREST returned it. */
  createdAt: string;
  /** That row's primary key, breaking the tie. */
  id: string;
};

export type LeadDirection = "asc" | "desc";

/**
 * `~` separates the two halves. It appears in neither an ISO instant nor a
 * uuid, so the split is unambiguous without escaping.
 */
const CURSOR_SEPARATOR = "~";

const INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:?\d{2}|Z)?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A cursor arrives from the URL and is interpolated into PostgREST's `or=`
 * grammar — which is a grammar, not a parameter list. So each half is validated
 * against the shape its column can actually hold rather than escaped: neither an
 * ISO instant nor a uuid can contain the comma or parenthesis that would end a
 * predicate early.
 *
 * An unparseable cursor is dropped rather than rejected — a stale bookmark
 * should show the newest leads, not an error.
 */
export function parseLeadCursor(raw: string | undefined): LeadCursor | null {
  if (!raw) return null;

  const split = raw.lastIndexOf(CURSOR_SEPARATOR);
  if (split <= 0) return null;

  const createdAt = raw.slice(0, split);
  const id = raw.slice(split + 1);

  if (!INSTANT.test(createdAt) || !UUID.test(id)) return null;

  return { createdAt, id };
}

export function formatLeadCursor(cursor: LeadCursor): string {
  return `${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.id}`;
}

export function leadCursorFrom(row: { id: string; created_at: string }): LeadCursor {
  return { createdAt: row.created_at, id: row.id };
}

/**
 * The `or=` predicate for "strictly past this row, in this direction".
 *
 * `(created_at, id) < (v, r)` has no row-value form in PostgREST, so it is
 * written out: either the timestamp is already past `v`, or it equals `v` and
 * the key is past `r`.
 */
export function leadKeysetClause(direction: LeadDirection, cursor: LeadCursor): string {
  const op = direction === "asc" ? "gt" : "lt";
  return (
    `created_at.${op}.${cursor.createdAt},` +
    `and(created_at.eq.${cursor.createdAt},id.${op}.${cursor.id})`
  );
}
