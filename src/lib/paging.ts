/**
 * Paging primitives, under the surface-neutral name every reader should import
 * them by.
 *
 * The implementations live in `./admin/paging` because the workspace was the
 * first surface that needed them, and nothing in them is about the workspace: a
 * keyset cursor over `(created_at, id)` knows nothing about who is reading, and
 * the reasoning in that file — why the cursor is a pair, why an activity feed
 * gets keyset and an alphabetical directory gets offset — applies verbatim to
 * the customer portal's feed and document list.
 *
 * So the portal imports from here rather than carrying a second copy. Folding
 * the implementation into this file and pointing the workspace at it is a
 * follow-up that changes import lines only; it is deliberately not done in the
 * same pass as a new surface, because a move touches every list in the product
 * and a re-export touches none of them.
 */

export {
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
} from "./admin/paging";

export type {
  OffsetBounds,
  PageDirection,
  PageSlice,
  TimeCursor,
} from "./admin/paging";
