import { notFound } from "next/navigation";
import { EmptyState, Panel, PanelBody } from "@/components/admin/admin-shell";
import { ListPager, listMeta } from "@/components/admin/list-pager";
import { StatusPill } from "@/components/admin/status-pill";
import { actionLabel } from "@/lib/admin/audit-vocabulary";
import { pageCursors } from "@/lib/admin/audit-range";
import {
  firstParam,
  formatTimeCursor,
  isUuid,
  pageSlice,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/admin/paging";
import { loadClaimContext } from "@/lib/claims/queries";
import { isClaimStatus } from "@/lib/claims/status";
import { formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/*
 * Action wording comes from `audit-vocabulary.ts` and from nowhere else.
 *
 * This file used to keep a private 17-entry map of its own against that
 * module's 56, so 39 codes fell through to the raw string and the same event
 * was named two different things on two screens: `/admin/audit` printed
 * "E-sign state changed" where this panel printed `esign.state_changed`. The
 * gap was not random — it was the whole LOR path plus every `staff.*` and
 * `partner_company.*` action, which is to say the codes added after this map
 * was written. A second copy of a vocabulary does not drift evenly; it drifts
 * exactly where the product has grown.
 */

const PAGE_SIZE = 40;

/**
 * Which audit entries belong to a claim.
 *
 * `entity_id` holds the primary key of the row that *changed*, which for a
 * status advance is the `claim_status_history` row's id and not the claim's —
 * so filtering on `entity_id` alone matched exactly the two entries whose
 * subject happens to be the claim row itself (`claims.insert`) or a table keyed
 * on the claim (`claim_financials.insert`). Every other entry names the claim
 * in `meta.claim_id`, which is what `public.audit_row_change()` writes and what
 * `/admin/audit` reads. Measured on the seed: this panel showed 2 entries for
 * CMG-2026-0001 while `/admin/audit` showed 17 naming that same claim, and the
 * panel's empty state would have asserted the same falsehood on a claim with no
 * insert row of its own.
 *
 * `claimId` is interpolated into `or=`, which is a grammar rather than a
 * parameter list — the same fact `parseTimeCursor` is built around. It arrives
 * from the route segment, and `loadClaimContext` has already refused a
 * malformed one with `notFound()`; the guard is repeated at the point of
 * interpolation so the invariant is visible where it is relied on rather than
 * two calls away.
 */
function claimScopeClause(claimId: string): string {
  return `entity_id.eq.${claimId},meta->>claim_id.eq.${claimId}`;
}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { can } = await loadClaimContext(id);
  if (!isUuid(id)) notFound();

  const raw = await searchParams;
  const supabase = await createClient();

  // Two independent windows on one screen, so each carries its own pair of
  // parameters. Sharing one would move both panels on every click.
  const movesForward = parseTimeCursor(firstParam(raw, "moves"));
  const movesBackward = movesForward
    ? null
    : parseTimeCursor(firstParam(raw, "movesPrev"));
  const movesCursor = movesForward ?? movesBackward;
  const movesReversed = movesBackward !== null;

  const trailBefore = parsePositiveInt(firstParam(raw, "trail"));
  const trailAfter = trailBefore === null
    ? parsePositiveInt(firstParam(raw, "trailPrev"))
    : null;
  const trailAscending = trailAfter !== null;

  let movesQuery = supabase
    .from("claim_status_history")
    .select(
      "id, from_status, to_status, note, created_at, changed_by, actor:profiles!claim_status_history_changed_by_fkey(first_name, last_name)",
    )
    .eq("claim_id", id)
    .order("created_at", { ascending: movesReversed })
    .order("id", { ascending: movesReversed })
    .limit(PAGE_SIZE + 1);

  if (movesCursor) {
    movesQuery = movesQuery.or(
      timeKeysetClause(movesReversed ? "asc" : "desc", movesCursor),
    );
  }

  // `audit_log_select_owner` is exactly what its name says, so this query
  // returns nothing for an adjuster or an assistant rather than failing. The
  // panel is only rendered for an owner so the difference is never mistaken
  // for "nothing has happened on this claim".
  let trailQuery = can.isOwner
    ? supabase
        .from("audit_log")
        .select("id, action, entity, actor_id, meta, created_at")
        .or(claimScopeClause(id))
        .order("id", { ascending: trailAscending })
        .limit(PAGE_SIZE + 1)
    : null;

  if (trailQuery && trailBefore !== null) trailQuery = trailQuery.lt("id", trailBefore);
  if (trailQuery && trailAfter !== null) trailQuery = trailQuery.gt("id", trailAfter);

  const [moves, movesCount, trail, trailCount] = await Promise.all([
    movesQuery,
    // Counted without the keyset predicate: folding it in would make the total
    // mean "matches on this page and after it", so the header would count down
    // as the reader paged — the opposite of what a total is for.
    supabase
      .from("claim_status_history")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
    trailQuery ?? Promise.resolve({ data: [] }),
    can.isOwner
      ? supabase
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .or(claimScopeClause(id))
      : Promise.resolve({ count: 0 }),
  ]);

  const movesPage = pageSlice(moves.data ?? [], PAGE_SIZE, movesReversed);
  const movesTotal = movesCount.count ?? movesPage.rows.length;
  const movesLinks = pageCursors({
    ids: movesPage.rows.map((row) => formatTimeCursor(timeCursorFrom(row))),
    hasMore: movesPage.hasMore,
    ascending: movesReversed,
    cameFromCursor: movesCursor !== null,
  });

  const trailPage = pageSlice(trail.data ?? [], PAGE_SIZE, trailAscending);
  const trailTotal = trailCount.count ?? trailPage.rows.length;
  const trailLinks = pageCursors({
    ids: trailPage.rows.map((row) => row.id),
    hasMore: trailPage.hasMore,
    ascending: trailAscending,
    cameFromCursor: trailBefore !== null || trailAfter !== null,
  });

  /**
   * Every link is rebuilt from the parsed cursors, so a junk parameter never
   * survives a click — and each panel's links carry the *other* panel's
   * position unchanged, which is what stops paging the audit trail from
   * throwing the status list back to its first page.
   */
  const base = `/admin/claims/${id}/history`;
  const build = (pairs: [string, string][]): string => {
    const query = new URLSearchParams(pairs).toString();
    return query ? `${base}?${query}` : base;
  };

  const movesHeld: [string, string][] = movesForward
    ? [["moves", formatTimeCursor(movesForward)]]
    : movesBackward
      ? [["movesPrev", formatTimeCursor(movesBackward)]]
      : [];
  const trailHeld: [string, string][] = trailBefore !== null
    ? [["trail", String(trailBefore)]]
    : trailAfter !== null
      ? [["trailPrev", String(trailAfter)]]
      : [];

  const movesHref = (key: "moves" | "movesPrev", value: string) =>
    build([[key, value], ...trailHeld]);
  const trailHref = (key: "trail" | "trailPrev", value: string) =>
    build([...movesHeld, [key, value]]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <Panel
        title="Status history"
        meta={listMeta(movesPage.rows.length, movesTotal, "move", "moves")}
      >
        {movesPage.rows.length === 0 ? (
          <EmptyState headline="No moves recorded.">
            Every status change writes a line here with who made it and why.
          </EmptyState>
        ) : (
          <>
            <ol className="divide-y divide-ink/8">
              {movesPage.rows.map((entry) => {
                const actor = entry.actor
                  ? `${entry.actor.first_name ?? ""} ${entry.actor.last_name ?? ""}`.trim()
                  : null;

                return (
                  <li key={entry.id} className="px-[clamp(14px,1.6vw,20px)] py-[13px]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                      {entry.from_status && isClaimStatus(entry.from_status) ? (
                        <>
                          <StatusPill status={entry.from_status} />
                          <span aria-hidden="true" className="text-ink/28">
                            →
                          </span>
                        </>
                      ) : null}
                      {isClaimStatus(entry.to_status) ? (
                        <StatusPill status={entry.to_status} />
                      ) : null}
                    </div>

                    <p className="mt-[7px] text-[11.5px] leading-[1.4] text-ink/38">
                      {actor ?? "System"} · {formatTimestamp(entry.created_at)}
                    </p>

                    {entry.note ? (
                      <p className="mt-[7px] max-w-[70ch] whitespace-pre-line text-[13px] leading-[1.65] text-ink/72">
                        {entry.note}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <ListPager
              label="Status history pages"
              noun="move"
              pluralNoun="moves"
              placement="footer"
              shown={movesPage.rows.length}
              total={movesTotal}
              prevHref={
                movesLinks.newerThan ? movesHref("movesPrev", movesLinks.newerThan) : null
              }
              nextHref={
                movesLinks.olderThan ? movesHref("moves", movesLinks.olderThan) : null
              }
              startHref={movesCursor ? build(trailHeld) : null}
            />
          </>
        )}
      </Panel>

      {can.isOwner ? (
        <Panel
          title="Audit trail"
          meta={listMeta(trailPage.rows.length, trailTotal, "entry", "entries")}
        >
          {trailPage.rows.length === 0 ? (
            <EmptyState headline="Nothing recorded against this claim yet.">
              Row-level changes and every signed download link land here.
            </EmptyState>
          ) : (
            <>
              <ol className="divide-y divide-ink/8">
                {trailPage.rows.map((entry) => (
                  <li key={entry.id} className="px-[clamp(14px,1.6vw,20px)] py-[11px]">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-[12.5px] leading-[1.45] text-ink/78">
                        {actionLabel(entry.action)}
                      </p>
                      <time
                        dateTime={entry.created_at}
                        className="shrink-0 text-[11.5px] leading-[1.4] tabular-nums text-ink/32"
                      >
                        {formatTimestamp(entry.created_at)}
                      </time>
                    </div>
                    <p className="mt-[3px] font-mono text-[11px] leading-[1.45] text-ink/30">
                      {entry.action}
                    </p>
                  </li>
                ))}
              </ol>

              <ListPager
                label="Audit trail pages"
                noun="entry"
                pluralNoun="entries"
                placement="footer"
                shown={trailPage.rows.length}
                total={trailTotal}
                prevHref={
                  trailLinks.newerThan
                    ? trailHref("trailPrev", String(trailLinks.newerThan))
                    : null
                }
                nextHref={
                  trailLinks.olderThan
                    ? trailHref("trail", String(trailLinks.olderThan))
                    : null
                }
                startHref={
                  trailBefore !== null || trailAfter !== null ? build(movesHeld) : null
                }
              />
            </>
          )}
        </Panel>
      ) : (
        <Panel title="Audit trail">
          <PanelBody>
            <p className="text-[12.5px] leading-[1.7] text-ink/50">
              The full audit trail — every row change, every invitation, every
              download link issued — is readable by the owner. It is append-only
              and carries no update or delete permission for anyone, including
              them.
            </p>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}

/** `audit_log.id` is `generated always as identity`, so a cursor on it is a positive integer. */
function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
