import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { ClaimFilters } from "@/components/admin/claim-filters";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { ListPager } from "@/components/admin/list-pager";
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
import {
  applyClaimFilters,
  hasActiveFilters,
  parseClaimFilters,
} from "@/lib/claims/search";
import { isClaimStatus } from "@/lib/claims/status";
import { requireStaff } from "@/lib/authz";
import { formatDateOnly, formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadClaimantSummaries } from "@/lib/claims/claimants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claims",
  robots: { index: false, follow: false },
};

/** The shape `generate_claim_ref()` writes, and the only thing the hand-off
 *  banner below will repeat back from the query string. */
const CLAIM_REF = /^CMG-\d{4}-\d{4}$/;

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

  let query = applyClaimFilters(supabase.rpc("staff_claims_projection"), filters)
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
    applyClaimFilters(
      supabase.rpc("staff_claims_projection", undefined, {
        count: "exact",
        head: true,
      }),
      filters,
    ),
  ]);

  if (error) console.error("[claims] list query failed", error.message);
  if (countError) console.error("[claims] count query failed", countError.message);

  const fetched = claims ?? [];
  const hasMore = fetched.length > CLAIMS_PAGE_SIZE;
  const window = fetched.slice(0, CLAIMS_PAGE_SIZE);
  const rows = reversed ? [...window].reverse() : window;
  const claimantRows = await loadClaimantSummaries(rows.map((claim) => claim.id));
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

  /* Read as a claim reference and nothing else — these arrive only from this
     app's own redirect, but a query parameter is a query parameter. */
  const bannerRef = (kind: "handedOn" | "released") => {
    const value = first(kind) ?? "";
    return CLAIM_REF.test(value) ? { kind, ref: value } : null;
  };
  const banner =
    session.role === "adjuster"
      ? (bannerRef("handedOn") ?? bannerRef("released"))
      : null;

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

      {/* Where an adjuster's own hand-off lands. `reassign_claim` judges the
          caller against the row as it was, so the write succeeds and the claim
          then leaves their view — re-rendering the claim in place showed them
          the workspace 404 and the success sentence was never read.

          Gated on the role and on the shape of the reference, because neither
          was true when this was written. "…has left your list" is only a fact
          for an adjuster: an owner reading the same URL was told a claim had
          left a list it was sitting in as the first row, announced through
          `role="status"`. And the parameter was echoed after nothing but a
          length cap, so `?handedOn=Not a claim at all` rendered as a sentence
          about a claim by that name. A banner URL is a plain GET — it survives
          the back button, a reload, a bookmark and a pasted link — so it has to
          hold up outside the one flow that produces it. */}
      {banner ? (
        <p
          role="status"
          className="mb-[clamp(14px,1.6vw,20px)] border-l-2 border-accent py-[2px] pl-[10px] text-[12.5px] leading-[1.55] text-ink/72"
        >
          {banner.kind === "handedOn"
            ? `${banner.ref} is now with another adjuster and has left your list.`
            : `${banner.ref} is back in the intake queue and has left your list.`}
        </p>
      ) : null}

      <ClaimFilters
        adjusters={adjusters}
        partners={partners}
        resultCount={total}
        showAdjusterFilter={session.role !== "adjuster"}
      />

      {/* Titled, where it used to be a bare box. Every other list in the
          workspace gives its panel a heading — "Accounts" on staff, "Companies"
          on partners, "Matching entries" / "All activity" on the audit trail —
          and `/admin/leads` gets one per row from the person's name. This screen
          had an `h1` and then nothing: a document outline one level deep, and no
          landmark between the filter bar and a seven-column table for a
          screen-reader user to move to.

          What the heading says is the one fact the filter bar above it changes:
          whether these rows are the list or a selection out of it. Same pair,
          and same reasoning, as the audit viewer. */}
      <Panel title={hasActiveFilters(filters) ? "Matching claims" : "All claims"}>
        {/* `paged` is tested before the filters, and the order is the whole
            point. A filtered list paged past its end took the filter arm and
            said "Nothing matches those filters" while the header above it
            counted the matches — because `total` is deliberately counted
            without the keyset predicate, so it stays right while the window is
            empty. The reader was told their filter matched nothing, on a screen
            saying it matched two, with Clear as the only control offered: the
            one action that throws away the filter they had built. Reachable by
            paging into a filtered list and having the rows move underneath you,
            and by any stale link into one. `/admin/leads` has always ordered
            these two correctly; this is the same order, and the link back keeps
            the filter. */}
        {rows.length === 0 ? (
          paged ? (
            <EmptyState headline="You have reached the end of the list.">
              <Link href={href()} className="text-accent no-underline hover:text-accent-300">
                {hasActiveFilters(filters)
                  ? "Back to the first page of these filters"
                  : "Back to the start"}
              </Link>
            </EmptyState>
          ) : hasActiveFilters(filters) ? (
            <EmptyState headline="Nothing matches those filters.">
              Try a shorter search, or clear the filters to see the whole list.
            </EmptyState>
          ) : (
            <EmptyState headline="No claims yet.">
              Accept an intake and it appears here with its reference and adjuster.
            </EmptyState>
          )
        ) : (
          <DataTable
            stickyColumnWidth={148}
            caption={`Claims, sorted by ${SORT_LABEL[sort.key]}`}
            /* 1080, up from 1040, because REFERENCE and REFERRED BY each gained
               width below and the flexible Homeowner column would otherwise
               have paid for both — 258px at the floor before, 218px after. The
               floor moves by exactly the 40px the two columns took. */
            minWidth={1080}
            head={
              <>
                {/* 148, up from 132. `CMG-2026-0001` plus the sort caret needs
                    141px at the rendered size, so the column was clipping the
                    glyph it exists to make clickable. */}
                <Th className="w-[148px]" sort={sortFor("ref")}>
                  Reference
                </Th>
                <Th>Homeowner &amp; property</Th>
                <Th className="w-[150px]" sort={sortFor("status")}>
                  Status
                </Th>
                <Th className="w-[128px]">Adjuster</Th>
                {/* 164, up from 140. A contractor's registered name is the
                    longest value in this table after the address, and it is the
                    one an owner filters on. */}
                <Th className="w-[164px]">Referred by</Th>
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
                claimantRows.get(claim.id)?.find((person) => person.is_primary) ??
                claimantRows.get(claim.id)?.[0];
              const adjusterName = claim.adjuster_name;

              return (
                <Tr key={claim.id}>
                  <Td>
                    {/* The reference is the row's link, and the only one. A whole
                        row wrapped in an anchor cannot hold the per-row controls
                        the detail page needs later, and nested interactive
                        elements are invalid besides. */}
                    <Link
                      href={`/admin/claims/${claim.id}`}
                      className="tap-block text-ink no-underline transition-colors duration-150 hover:text-accent"
                    >
                      <ClaimRef value={claim.claim_ref} />
                    </Link>
                  </Td>
                  <Td>
                    <span
                      className="block truncate"
                      title={
                        primary
                          ? `${primary.first_name} ${primary.last_name}`.trim()
                          : undefined
                      }
                    >
                      {primary
                        ? `${primary.first_name} ${primary.last_name}`.trim()
                        : "—"}
                    </span>
                    <CellMeta
                      title={`${claim.property_street}, ${claim.property_city}, ${claim.property_state} ${claim.property_zip}`}
                    >
                      {claim.property_street}, {claim.property_city},{" "}
                      {claim.property_state} {claim.property_zip}
                    </CellMeta>
                  </Td>
                  <Td>
                    {isClaimStatus(claim.status) ? (
                      <StatusPill status={claim.status} />
                    ) : null}
                  </Td>
                  <Td tone="meta" className="truncate" title={adjusterName ?? undefined}>
                    {adjusterName || (
                      <span className="text-accent/70">Unassigned</span>
                    )}
                  </Td>
                  <Td tone="meta">
                    {/* `title` because the column is `truncate` inside a cell
                        whose own overflow is hidden — scrolling the table
                        sideways does not reveal a clipped company name, so
                        without this the value is unrecoverable at 390px. */}
                    <span
                      className="block truncate"
                      title={claim.partner_name ?? "Direct"}
                    >
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
                      {claim.partner_name ?? (
                        <span className="text-ink/55">Direct</span>
                      )}
                    </span>
                  </Td>
                  <Td tone="meta" className="whitespace-nowrap tabular-nums">
                    {formatDateOnly(claim.loss_date)}
                  </Td>
                  <Td tone="quiet" className="whitespace-nowrap tabular-nums">
                    {formatRelative(claim.updated_at)}
                  </Td>
                </Tr>
              );
            })}
          </DataTable>
        )}
      </Panel>

      {rows.length > 0 ? (
        /* The shared pager, not a private copy of it. This screen had its own —
           byte-for-byte the same sentence as `/admin/leads` — which is how two
           lists end up saying different things about the same situation. Round
           4's commit message records that this consolidation was written and
           then lost to an interrupted session; this is it. */
        <ListPager
          label="Claims pages"
          noun="claim"
          pluralNoun="claims"
          qualifier={SORT_LABEL[sort.key]}
          shown={rows.length}
          total={total}
          prevHref={prevCursor ? pageHref("prev", prevCursor) : null}
          nextHref={nextCursor ? pageHref("next", nextCursor) : null}
          startHref={paged ? href() : null}
        />
      ) : null}
    </>
  );
}
