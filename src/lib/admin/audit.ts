import "server-only";

import { ROLE_LABEL } from "@/components/admin/nav";
import { isAppRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { collectPostgrestPages } from "@/lib/supabase/collect-pages";
import type { Json } from "@/types/database";
import { dayBounds, pageCursors } from "./audit-range";
import {
  hasActiveFilters,
  readAuditFilters,
  type AuditFilters,
} from "./audit-query";

/* Re-exported so the page keeps one import for the whole viewer, while the
   client filter bar reads the same two functions from the pure module. */
export { hasActiveFilters, readAuditFilters, type AuditFilters };

export type AuditEntry = {
  id: number;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  ip: string | null;
  meta: Json;
  /**
   * `meta.claim_id` resolved to the reference the workspace uses everywhere
   * else, or null when the entry names no claim or the claim is gone.
   */
  claimRef: string | null;
};

export type AuditPage = {
  entries: AuditEntry[];
  /**
   * Every entry matching the filters, not just this page.
   *
   * The panel used to read `${rows.length} shown`, which on a full page is the
   * page size and nothing else — "40 shown" over an unfiltered log of ten
   * thousand and over a filtered set of forty-one, identically. `/admin/audit`
   * was the last list in the workspace without a real total, and it is the one
   * where the number matters most: narrowing to an actor and a date range is
   * asking *how much of this happened*, and the screen could not answer.
   */
  total: number;
  /** Cursor for the next (older) page, or null at the end of the log. */
  olderThan: number | null;
  /** Cursor for the previous (newer) page, or null on the newest page. */
  newerThan: number | null;
};

export const AUDIT_PAGE_SIZE = 40;

/**
 * `audit_log.id` is `generated always as identity`, so it is assigned in insert
 * order and never reused. Paging on it rather than on `created_at` avoids the
 * two problems an offset or a timestamp cursor would bring:
 *
 *   * `offset 40 * n` re-walks every skipped row, so page 50 of a security log
 *     costs fifty times page 1;
 *   * `created_at` defaults to `now()`, which is transaction *start* time, so
 *     two entries can share a timestamp and a `<` cursor on it silently drops
 *     whichever tied at the page boundary — in an audit trail, the one row you
 *     would never notice missing.
 *
 * Id order is also the true sequence of events, which is what "who did what,
 * then what happened next" means. The primary key's btree serves both directions
 * of the scan, and `created_at` is displayed rather than ordered on.
 *
 * A page is fetched with one extra row: its presence is what says there is
 * another page, without a second count query.
 */
/**
 * The two PostgREST builder methods the filter pass uses, written as methods so
 * the concrete builders — whose `eq` is keyed to the row's own column union —
 * both satisfy it. Same shape and same reason as `ClaimQuery` on the claims
 * list: spelling the five filters out twice, once for the page and once for the
 * count, is exactly how a list and its total start disagreeing about what
 * "matching" means.
 */
type AuditQuery<Q> = {
  eq(column: string, value: string): Q;
  gte(column: string, value: string): Q;
  lt(column: string, value: string): Q;
};

export async function loadAuditPage(filters: AuditFilters): Promise<AuditPage> {
  const supabase = await createClient();

  /**
   * Everything the reader asked for except where they are in the log.
   *
   * The keyset predicate is deliberately not in here: folding it into the count
   * would make the total mean "matches on this page and after it", so the
   * header would count down as the reader paged — the opposite of what a total
   * is for.
   */
  function applyFilters<Q extends AuditQuery<Q>>(query: Q): Q {
    let next = query;
    if (filters.action) next = next.eq("action", filters.action);
    if (filters.entity) next = next.eq("entity", filters.entity);
    if (filters.actor) next = next.eq("actor_id", filters.actor);

    // A calendar day in the business's zone, as a half-open instant range — see
    // `dayBounds`. A bare date would reach Postgres as UTC midnight, so "from
    // 10 August" would start at 8pm on the 9th in Orlando and the filter would
    // disagree with the timestamps printed beside it.
    const fromBounds = filters.from ? dayBounds(filters.from) : null;
    const toBounds = filters.to ? dayBounds(filters.to) : null;
    if (fromBounds) next = next.gte("created_at", fromBounds.startIso);
    if (toBounds) next = next.lt("created_at", toBounds.endIso);

    return next;
  }

  let query = applyFilters(
    supabase
      .from("audit_log")
      .select("id, created_at, action, entity, entity_id, actor_id, ip, meta"),
  ).limit(AUDIT_PAGE_SIZE + 1);

  // Paging backwards means walking ascending from the cursor and reversing the
  // window, so the reader still sees newest-first on every page.
  const after = filters.after;
  const ascending = after !== null && filters.before === null;

  if (filters.before !== null) query = query.lt("id", String(filters.before));
  if (ascending && after !== null) query = query.gt("id", String(after));

  query = query.order("id", { ascending });

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    query,
    applyFilters(
      supabase.from("audit_log").select("id", { count: "exact", head: true }),
    ),
  ]);

  if (countError) {
    console.error("[audit] count read failed", countError.message);
  }

  if (error) {
    console.error("[audit] page read failed", error.message);
    return { entries: [], total: 0, olderThan: null, newerThan: null };
  }

  const rows = data ?? [];
  const hasMore = rows.length > AUDIT_PAGE_SIZE;
  const window = rows.slice(0, AUDIT_PAGE_SIZE);
  const ordered = ascending ? [...window].reverse() : window;

  const [actors, claimRefs] = await Promise.all([
    loadActorNames(ordered.map((row) => row.actor_id)),
    loadClaimRefs(ordered.map((row) => claimIdIn(row.meta))),
  ]);

  const entries: AuditEntry[] = ordered.map((row) => {
    const actor = row.actor_id ? actors.get(row.actor_id) : undefined;
    const claimId = claimIdIn(row.meta);
    return {
      id: row.id,
      createdAt: row.created_at,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      actorId: row.actor_id,
      actorName: actor?.name ?? null,
      actorRole: actor?.role ?? null,
      ip: typeof row.ip === "string" ? row.ip : null,
      meta: row.meta,
      claimRef: claimId ? (claimRefs.get(claimId) ?? null) : null,
    };
  });

  return {
    entries,
    total: count ?? entries.length,
    ...pageCursors({
      ids: entries.map((entry) => entry.id),
      hasMore,
      ascending,
      cameFromCursor: filters.before !== null || filters.after !== null,
    }),
  };
}

type Actor = { name: string; role: string };

/**
 * Resolves only the actors on the page — a join would re-fetch the same handful
 * of staff rows for every entry, and `audit_log` deliberately holds no foreign
 * key into `profiles` so that deleting a person cannot rewrite history. That
 * also means an id here may name nobody, which is rendered as the raw actor
 * rather than as "unknown": the log is still the record that they acted.
 */
async function loadActorNames(
  ids: readonly (string | null)[],
): Promise<Map<string, Actor>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("id", unique);

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      {
        name:
          [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
          "Unnamed account",
        role: isAppRole(row.role) ? ROLE_LABEL[row.role] : row.role,
      },
    ]),
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `meta.claim_id`, which `public.audit_row_change()` writes as a text uuid. */
function claimIdIn(meta: Json): string | null {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;
  const value = (meta as { claim_id?: Json }).claim_id;
  return typeof value === "string" && UUID.test(value) ? value : null;
}

/**
 * The references for the claims named on this page.
 *
 * A second query rather than an embedded join, for the reason `loadActorNames`
 * gives one line up: `audit_log` holds no foreign key into `claims` — deleting a
 * claim must not be able to rewrite the record of what was done to it — so
 * PostgREST has no relationship to embed. It also means a claim can be missing
 * here, which is why a miss falls back to the raw uuid at the call site rather
 * than to "unknown": the log is still the record that the row existed.
 *
 * `claims_select` is what admits the read, and it already gives an owner every
 * claim; `/admin/audit` is owner-only, so this never narrows the page.
 */
async function loadClaimRefs(
  ids: readonly (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("claims")
    .select("id, claim_ref")
    .in("id", unique);

  return new Map((data ?? []).map((row) => [row.id, row.claim_ref]));
}

export type ActorOption = { id: string; name: string; role: string };

/**
 * Everyone who could appear in the actor column. Read from `profiles` rather
 * than from `select distinct actor_id from audit_log`, which would scan the log
 * to build a dropdown.
 */
export async function loadActorOptions(): Promise<ActorOption[]> {
  const supabase = await createClient();
  const data = await collectPostgrestPages((from, to) =>
    supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .order("role", { ascending: true })
      .order("last_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  return data.map((row) => ({
    id: row.id,
    name:
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
      "Unnamed account",
    role: isAppRole(row.role) ? ROLE_LABEL[row.role] : row.role,
  }));
}
