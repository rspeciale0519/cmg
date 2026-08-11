import { isKnownAction, isKnownEntity } from "./audit-vocabulary";

/**
 * What the audit viewer was asked for, taken from the URL and validated.
 *
 * Pure, and deliberately *not* in `audit.ts`, which is `server-only`. The filter
 * bar is a client component and has to answer the same question the page does —
 * "is anything actually filtered?" — and it was answering it from the raw query
 * string instead. So `?from=notadate` put "Clear filters" on a page where every
 * control read its default and nothing had been narrowed: the affordance
 * offered to undo something that had not happened. One definition, read by
 * both halves, is the only way those two answers stay the same answer.
 */

export type AuditFilters = {
  action: string;
  entity: string;
  actor: string;
  from: string;
  to: string;
  /** Keyset cursor: page of entries strictly older than this id. */
  before: number | null;
  /** Keyset cursor: page of entries strictly newer than this id. */
  after: number | null;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function intOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function single(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Everything the viewer can be asked for, validated here so neither the page
 * nor the filter bar ever handles a raw parameter. Unknown actions, unknown
 * entities and malformed dates are dropped rather than rejected: a stale
 * bookmark should show the log, not an error.
 */
export function readAuditFilters(
  params: Record<string, string | string[] | undefined>,
): AuditFilters {
  const action = single(params, "action") ?? "";
  const entity = single(params, "entity") ?? "";
  const actor = single(params, "actor") ?? "";
  const from = single(params, "from") ?? "";
  const to = single(params, "to") ?? "";

  return {
    action: isKnownAction(action) ? action : "",
    entity: isKnownEntity(entity) ? entity : "",
    actor: UUID.test(actor) ? actor : "",
    from: DATE_ONLY.test(from) ? from : "",
    to: DATE_ONLY.test(to) ? to : "",
    before: intOrNull(single(params, "before")),
    after: intOrNull(single(params, "after")),
  };
}

export function hasActiveFilters(filters: AuditFilters): boolean {
  return Boolean(
    filters.action || filters.entity || filters.actor || filters.from || filters.to,
  );
}
