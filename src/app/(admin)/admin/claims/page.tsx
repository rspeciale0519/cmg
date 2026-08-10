import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { ClaimFilters } from "@/components/admin/claim-filters";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { ClaimRef, StatusPill } from "@/components/admin/status-pill";
import { loadAdjusters, loadPartnerCompanies } from "@/lib/claims/queries";
import { claimSearchClause, hasActiveFilters, parseClaimFilters } from "@/lib/claims/search";
import { isClaimStatus } from "@/lib/claims/status";
import { requireStaff } from "@/lib/authz";
import { formatDateOnly, formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Claims",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 60;

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

  let query = supabase
    .from("claims")
    .select(
      `id, claim_ref, status, loss_date, updated_at,
       property_street, property_city, property_state, property_zip,
       assigned_adjuster_id,
       adjuster:profiles!claims_assigned_adjuster_id_fkey(first_name, last_name),
       partner:partner_companies!claims_partner_company_id_fkey(name),
       claimants(first_name, last_name, is_primary)`,
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (filters.status) query = query.eq("status", filters.status);

  if (filters.adjusterId === "unassigned") {
    query = query.is("assigned_adjuster_id", null);
  } else if (filters.adjusterId) {
    query = query.eq("assigned_adjuster_id", filters.adjusterId);
  }

  if (filters.partnerId === "none") {
    query = query.is("partner_company_id", null);
  } else if (filters.partnerId) {
    query = query.eq("partner_company_id", filters.partnerId);
  }

  if (filters.search) {
    query = query.or(claimSearchClause(filters.search, claimantMatches));
  }

  const { data: claims, count, error } = await query;

  if (error) {
    console.error("[claims] list query failed", error.message);
  }

  const rows = claims ?? [];
  const [adjusters, partners] = await Promise.all([
    loadAdjusters(),
    loadPartnerCompanies(),
  ]);

  const scope =
    session.role === "adjuster"
      ? "The claims assigned to you. Reassignment moves a file off this list."
      : "Every claim in the business. Filter by stage, by adjuster, or by the contractor who referred it.";

  return (
    <>
      <PageHeader
        eyebrow={`${count ?? rows.length} total`}
        title="Claims."
        lede={scope}
      />

      <ClaimFilters
        adjusters={adjusters}
        partners={partners}
        resultCount={count ?? rows.length}
      />

      <Panel>
        {rows.length === 0 ? (
          hasActiveFilters(filters) ? (
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
            caption="Claims"
            head={
              <>
                <Th className="w-[132px]">Reference</Th>
                <Th>Homeowner &amp; property</Th>
                <Th className="w-[150px]">Status</Th>
                <Th className="w-[128px]">Adjuster</Th>
                <Th className="w-[140px]">Referred by</Th>
                <Th className="w-[104px]" align="right">
                  Loss date
                </Th>
                <Th className="w-[92px]" align="right">
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
                  <Td className="max-w-0">
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
                  <Td className="text-ink/62">
                    {adjusterName || (
                      <span className="text-accent/70">Unassigned</span>
                    )}
                  </Td>
                  <Td className="max-w-0 text-ink/62">
                    <span className="block truncate">
                      {claim.partner?.name ?? (
                        <span className="text-ink/32">Direct</span>
                      )}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums text-ink/62">
                    {formatDateOnly(claim.loss_date)}
                  </Td>
                  <Td align="right" className="tabular-nums text-ink/50">
                    {formatRelative(claim.updated_at)}
                  </Td>
                </Tr>
              );
            })}
          </DataTable>
        )}
      </Panel>

      {(count ?? 0) > rows.length ? (
        <p className="mt-3 text-[12px] leading-[1.5] text-ink/42">
          Showing the {rows.length} most recently updated of {count}. Narrow the
          filters to reach the rest.
        </p>
      ) : null}
    </>
  );
}
