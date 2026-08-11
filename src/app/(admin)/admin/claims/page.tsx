import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { ClaimFilters } from "@/components/admin/claim-filters";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { ClaimRef, StatusPill } from "@/components/admin/status-pill";
import { pageCursors } from "@/lib/admin/audit-range";
import { loadAdjusters, loadPartnerCompanies } from "@/lib/claims/queries";
import {
  CLAIM_SORT_COLUMN,
  CLAIM_TIE_BREAK,
  CLAIMS_PAGE_SIZE,
  columnSortState,
  cursorFrom,
  DEFAULT_CLAIM_SORT,
  flipDirection,
  formatClaimCursor,
  keysetClause,
  parseClaimCursor,
  parseClaimSort,
  sortActionLabel,
  SORT_LABEL,
  toggledSort,
  type ClaimSortKey,
} from "@/lib/claims/list";
import { claimSearchClause, hasActiveFilters, parseClaimFilters } from "@/lib/claims/search";
import { isClaimStatus } from "@/lib/claims/status";
import { requireStaff } from "@/lib/authz";
import { cx } from "@/lib/cx";
import { formatDateOnly, formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claims",
  robots: { index: false, follow: false },
};

/**
 * The three PostgREST builder methods the filter pass uses, written as methods
 * so the concrete builder — whose `eq` is keyed to the row's own column union —
 * still satisfies it. The alternative is spelling the four filters out twice,
 * once per query, which is exactly how a list and its count start disagreeing.
 */
type ClaimQuery<Q> = {
  eq(column: string, value: string): Q;
  is(column: string, value: null): Q;
  or(filter: string): Q;
};

const SELECT = `id, claim_ref, status, loss_date, updated_at,
   property_street, property_city, property_state, property_zip,
   assigned_adjuster_id,
   adjuster:profiles!claims_assigned_adjuster_id_fkey(first_name, last_name),
   partner:partner_companies!claims_partner_company_id_fkey(name),
   claimants(first_name, last_name, is_primary)`;

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaff("/admin/claims");
  const raw = await searchParams;
  const first = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const filters = parseClaimFilters({
    status: first("status"),
    adjuster: first("adjuster"),
    partner: first("partner"),
    q: first("q"),
  });

  const sort = parseClaimSort(first("sort"), first("dir"));

  // Forward wins if both are present: a URL carrying two cursors is hand-made,
  // and honouring the one that means "onwards" is the harmless reading.
  const forward = parseClaimCursor(sort.key, first("next"));
  const backward = forward ? null : parseClaimCursor(sort.key, first("prev"));
  const cursor = forward ?? backward;

  // Paging backwards means walking the opposite way from the cursor and
  // reversing the window, so the reader still sees the sort they asked for.
  const reversed = backward !== null;
  const walk = reversed ? flipDirection(sort.direction) : sort.direction;
  const ascending = walk === "asc";

  const supabase = await createClient();

  // Claimant names are matched in their own pass. Folding them into the main
  // query as an embedded filter would make the join inner and silently drop
  // every claim that has no claimants row — which is exactly the set a staff
  // member searching for a missing file is most likely to be looking for.
  let claimantMatches: string[] = [];
  if (filters.search) {
    const term = `%${filters.search}%`;
    const { data } = await supabase
      .from("claimants")
      .select("claim_id")
      .or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`,
      )
      .limit(200);
    claimantMatches = [...new Set((data ?? []).map((row) => row.claim_id))];
  }

  /**
   * Everything the reader asked for except where they are in the list, applied
   * to both the page query and the total-count query so the two can never
   * disagree about what "matching" means.
   */
  function applyFilters<Q extends ClaimQuery<Q>>(query: Q): Q {
    let next = query;
    if (filters.status) next = next.eq("status", filters.status);

    if (filters.adjusterId === "unassigned") {
      next = next.is("assigned_adjuster_id", null);
    } else if (filters.adjusterId) {
      next = next.eq("assigned_adjuster_id", filters.adjusterId);
    }

    if (filters.partnerId === "none") {
      next = next.is("partner_company_id", null);
    } else if (filters.partnerId) {
      next = next.eq("partner_company_id", filters.partnerId);
    }

    if (filters.search) {
      next = next.or(claimSearchClause(filters.search, claimantMatches));
    }

    return next;
  }

  let query = applyFilters(supabase.from("claims").select(SELECT))
    .order(CLAIM_SORT_COLUMN[sort.key], { ascending })
    .limit(CLAIMS_PAGE_SIZE + 1);

  // The tie-break is what makes the cursor safe; ordering on it is what makes
  // the cursor *match* the order. Sorting on the reference already is it.
  if (sort.key !== "ref") {
    query = query.order(CLAIM_TIE_BREAK, { ascending });
  }

  if (cursor) {
    query = query.or(keysetClause(sort.key, walk, cursor));
  }

  // The total is counted without the keyset predicate. Folding it into the main
  // query would make `count` mean "matches on this page and after it", so the
  // header would count down as the reader paged — the opposite of what a total
  // is for.
  const [{ data: claims, error }, { count, error: countError }] = await Promise.all([
    query,
    applyFilters(
      supabase.from("claims").select("id", { count: "exact", head: true }),
    ),
  ]);

  if (error) console.error("[claims] list query failed", error.message);
  if (countError) console.error("[claims] count query failed", countError.message);

  const fetched = claims ?? [];
  const hasMore = fetched.length > CLAIMS_PAGE_SIZE;
  const window = fetched.slice(0, CLAIMS_PAGE_SIZE);
  const rows = reversed ? [...window].reverse() : window;
  const total = count ?? rows.length;

  const { olderThan: nextCursor, newerThan: prevCursor } = pageCursors({
    ids: rows.map((claim) => formatClaimCursor(cursorFrom(sort.key, claim))),
    hasMore,
    ascending: reversed,
    cameFromCursor: cursor !== null,
  });

  const [adjusters, partners] = await Promise.all([
    loadAdjusters(),
    loadPartnerCompanies(),
  ]);

  /** Rebuilt from the parsed filters, so a junk parameter never survives a click. */
  function href(extra?: Record<string, string>): string {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.adjusterId) params.set("adjuster", filters.adjusterId);
    if (filters.partnerId) params.set("partner", filters.partnerId);
    if (filters.search) params.set("q", filters.search);
    for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
    const query = params.toString();
    return query ? `/admin/claims?${query}` : "/admin/claims";
  }

  function pageHref(cursorParam: "next" | "prev", value: string): string {
    const carried: Record<string, string> =
      sort.key === DEFAULT_CLAIM_SORT.key && sort.direction === DEFAULT_CLAIM_SORT.direction
        ? {}
        : { sort: sort.key, dir: sort.direction };
    return href({ ...carried, [cursorParam]: value });
  }

  function sortFor(column: ClaimSortKey) {
    const next = toggledSort(sort, column);
    const isDefault =
      next.key === DEFAULT_CLAIM_SORT.key &&
      next.direction === DEFAULT_CLAIM_SORT.direction;

    return {
      // The cursor is deliberately not carried: a position in one ordering
      // means nothing in another, and reusing it would open page 4 of a list
      // the reader has never seen page 1 of.
      href: isDefault ? href() : href({ sort: next.key, dir: next.direction }),
      state: columnSortState(sort, column),
      label: sortActionLabel(sort, column),
    } as const;
  }

  const scope =
    session.role === "adjuster"
      ? "The claims assigned to you. Reassignment moves a file off this list."
      : "Every claim in the business. Filter by stage, by adjuster, or by the contractor who referred it.";

  const paged = cursor !== null;

  return (
    <>
      <PageHeader
        eyebrow={`${total} total`}
        title="Claims."
        lede={scope}
      />

      <ClaimFilters
        adjusters={adjusters}
        partners={partners}
        resultCount={total}
      />

      <Panel>
        {rows.length === 0 ? (
          hasActiveFilters(filters) ? (
            <EmptyState headline="Nothing matches those filters.">
              Try a shorter search, or clear the filters to see the whole list.
            </EmptyState>
          ) : paged ? (
            <EmptyState headline="You have reached the end of the list.">
              <Link href={href()} className="text-accent no-underline hover:text-accent-300">
                Back to the start
              </Link>
            </EmptyState>
          ) : (
            <EmptyState headline="No claims yet.">
              Accept an intake and it appears here with its reference and adjuster.
            </EmptyState>
          )
        ) : (
          <DataTable
            caption={`Claims, sorted by ${SORT_LABEL[sort.key]}`}
            minWidth={1040}
            head={
              <>
                <Th className="w-[132px]" sort={sortFor("ref")}>
                  Reference
                </Th>
                <Th>Homeowner &amp; property</Th>
                <Th className="w-[150px]" sort={sortFor("status")}>
                  Status
                </Th>
                <Th className="w-[128px]">Adjuster</Th>
                <Th className="w-[140px]">Referred by</Th>
                <Th className="w-[116px]" sort={sortFor("loss")}>
                  Loss date
                </Th>
                <Th className="w-[116px]" sort={sortFor("updated")}>
                  Updated
                </Th>
              </>
            }
          >
            {rows.map((claim) => {
              const primary =
                claim.claimants?.find((person) => person.is_primary) ??
                claim.claimants?.[0];
              const adjusterName = claim.adjuster
                ? `${claim.adjuster.first_name ?? ""} ${claim.adjuster.last_name ?? ""}`.trim()
                : null;

              return (
                <Tr key={claim.id}>
                  <Td>
                    {/* The reference is the row's link, and the only one. A whole
                        row wrapped in an anchor cannot hold the per-row controls
                        the detail page needs later, and nested interactive
                        elements are invalid besides. */}
                    <Link
                      href={`/admin/claims/${claim.id}`}
                      className="text-ink no-underline transition-colors duration-150 hover:text-accent"
                    >
                      <ClaimRef value={claim.claim_ref} />
                    </Link>
                  </Td>
                  <Td>
                    <span className="block truncate">
                      {primary
                        ? `${primary.first_name} ${primary.last_name}`.trim()
                        : "—"}
                    </span>
                    <CellMeta>
                      {claim.property_street}, {claim.property_city},{" "}
                      {claim.property_state} {claim.property_zip}
                    </CellMeta>
                  </Td>
                  <Td>
                    {isClaimStatus(claim.status) ? (
                      <StatusPill status={claim.status} />
                    ) : null}
                  </Td>
                  <Td className="truncate text-ink/62">
                    {adjusterName || (
                      <span className="text-accent/70">Unassigned</span>
                    )}
                  </Td>
                  <Td className="text-ink/62">
                    <span className="block truncate">
                      {/* `ink/55` — 4.87:1 measured on the panel fill, up from
                          `ink/32` at 2.56:1. "Direct" is a value, not a blank: it
                          says this claim came in without a referring company,
                          which is the fact an owner filtering by partner is
                          looking for, so it has to clear the same bar a company
                          name does.

                          Chosen to sit under the cell's own colour whichever way
                          that resolves. The `Td` below carries two `text-ink/*`
                          utilities — its own default and the one passed here —
                          and the later rule in the generated stylesheet wins, so
                          a company name currently renders at `ink/78` rather
                          than the `ink/62` the call site asks for. `ink/55` is
                          quieter than both, so the column keeps reading
                          name-first either before or after that collision is
                          sorted out. */}
                      {claim.partner?.name ?? (
                        <span className="text-ink/55">Direct</span>
                      )}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-ink/62">
                    {formatDateOnly(claim.loss_date)}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums text-ink/50">
                    {formatRelative(claim.updated_at)}
                  </Td>
                </Tr>
              );
            })}
          </DataTable>
        )}
      </Panel>

      {rows.length > 0 ? (
        <ClaimsPager
          shown={rows.length}
          total={total}
          sortLabel={SORT_LABEL[sort.key]}
          prevHref={prevCursor ? pageHref("prev", prevCursor) : null}
          nextHref={nextCursor ? pageHref("next", nextCursor) : null}
          startHref={paged ? href() : null}
        />
      ) : null}
    </>
  );
}

/**
 * Says how much of the list is on screen before it offers to move. The old
 * screen showed sixty rows under a header that counted every claim in the
 * business, with nothing in between to say the two numbers were different —
 * so past sixty claims the page quietly stopped being a list of claims and
 * never mentioned it.
 */
function ClaimsPager({
  shown,
  total,
  sortLabel,
  prevHref,
  nextHref,
  startHref,
}: {
  shown: number;
  total: number;
  sortLabel: string;
  prevHref: string | null;
  nextHref: string | null;
  startHref: string | null;
}) {
  const complete = shown >= total && !prevHref && !nextHref;

  return (
    <nav
      aria-label="Claims pages"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-[clamp(14px,1.6vw,20px)]"
    >
      <p className="text-[12px] leading-[1.5] text-ink/45">
        {complete ? (
          <>
            All <span className="tabular-nums">{total}</span>{" "}
            {total === 1 ? "claim" : "claims"}, by {sortLabel}
          </>
        ) : (
          <>
            Showing <span className="tabular-nums">{shown}</span> of{" "}
            <span className="tabular-nums">{total}</span>, by {sortLabel}
            {startHref ? (
              <>
                {" · "}
                <Link
                  href={startHref}
                  className="text-accent no-underline transition-colors duration-150 hover:text-accent-300"
                >
                  Back to the start
                </Link>
              </>
            ) : null}
          </>
        )}
      </p>

      {prevHref || nextHref ? (
        <span className="flex items-center gap-2">
          <PageLink href={prevHref}>← Previous</PageLink>
          <PageLink href={nextHref}>Next →</PageLink>
        </span>
      ) : null}
    </nav>
  );
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) {
    return (
      <span aria-hidden="true" className="px-3 text-[12.5px] leading-[1.4] text-ink/20">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cx(
        "min-h-[34px] rounded-md border border-ink/16 px-3 py-[7px] text-[12.5px] leading-[1.4] text-ink/78 no-underline",
        "transition-colors duration-150 hover:border-ink/32 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
