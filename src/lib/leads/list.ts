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

import {
  formatTimeCursor,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
  type PageDirection,
  type TimeCursor,
} from "@/lib/admin/paging";

/**
 * The cursor itself now lives in `src/lib/admin/paging.ts`, because eight other
 * lists in the workspace needed the identical `(created_at, id)` pair and a
 * second copy of a rule is a rule that drifts — this file's own header used to
 * be the only place the reasoning was written down. The names below are kept as
 * the leads inbox's vocabulary; the behaviour is the shared one.
 */

/**
 * Forty, matching `/admin/audit` rather than the claims table's sixty. A lead is
 * a heading, two contact links and a paragraph — roughly four times a claim
 * row's height — so sixty of them is a page nobody reaches the bottom of.
 */
export const LEADS_PAGE_SIZE = 40;

export type LeadCursor = TimeCursor;
export type LeadDirection = PageDirection;

export const parseLeadCursor = parseTimeCursor;
export const formatLeadCursor = formatTimeCursor;
export const leadCursorFrom = timeCursorFrom;
export const leadKeysetClause = timeKeysetClause;
