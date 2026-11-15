import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { FormDisclosure } from "@/components/admin/disclosure";
import { FilterPills } from "@/components/admin/filter-pills";
import { ListPager } from "@/components/admin/list-pager";
import { PartnerCompanyForm } from "@/components/admin/partner-forms";
import { CountCell, PartnerStatusPill } from "@/components/admin/partner-status-pill";
import {
  loadPartnerPage,
  PARTNERS_PAGE_SIZE,
  type PartnerStatus,
} from "@/lib/admin/partners";
import {
  clampPage,
  firstParam,
  offsetBounds,
  parsePageNumber,
} from "@/lib/admin/paging";
import { metadataForRole, requireRole } from "@/lib/authz";
import { formatDateStamp } from "@/lib/format";

export const dynamic = "force-dynamic";

/* `generateMetadata` and not `export const metadata`, because a static title is
   emitted whether or not the component below ever renders — so a non-owner got
   the workspace 404 in the body and this page's real name in the tab. See
   `metadataForRole`. */
export async function generateMetadata(): Promise<Metadata> {
  return metadataForRole(["owner"], "Partners");
}

const FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

function isPartnerStatus(value: string): value is PartnerStatus {
  return value === "active" || value === "inactive";
}

/**
 * Owner only, and `requireRole` answers a non-owner with `notFound()` rather
 * than a 403 — an adjuster who guesses the URL learns nothing about whether the
 * surface exists (spec §7.9). The nav already filters this destination out for
 * them; this is the check that holds when someone types the path.
 *
 * The table's two numeric columns are the whole point of the list. "Reps" is
 * literally the count `guard_partner_company_delete()` runs before it refuses a
 * delete, and "Claims" is the answer to the only question worth asking about a
 * referral relationship. Zero renders as a hairline dash rather than "0", the
 * same idiom the nav's queue badges use: a relationship that has produced
 * nothing should look quiet, not alarming.
 */
export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("owner");

  const raw = await searchParams;
  const statusParam = firstParam(raw, "status");
  const status = statusParam && isPartnerStatus(statusParam) ? statusParam : "";
  const justDeleted = raw.deleted === "1";
  const airtableConnectionFailed = firstParam(raw, "airtable") === "connection_failed";

  // Counted first, so a stale `?page=9` on a three-page list lands on the last
  // page that exists rather than on an empty table under a header saying 42.
  const firstPass = await loadPartnerPage(status || null, 0, PARTNERS_PAGE_SIZE - 1);
  const page = clampPage(
    parsePageNumber(firstParam(raw, "page")),
    firstPass.total,
    PARTNERS_PAGE_SIZE,
  );
  const bounds = offsetBounds(page, PARTNERS_PAGE_SIZE);
  const { companies, total, activeTotal } =
    page === 1
      ? firstPass
      : await loadPartnerPage(status || null, bounds.from, bounds.to);

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `/admin/partners?${query}` : "/admin/partners";
  };

  return (
    <>
      <PageHeader
        eyebrow={`Owner · ${total} ${total === 1 ? "company" : "companies"}`}
        title="Partner companies."
        lede="Companies that refer claims to CMG. Their representatives can use a portal to see the stages, milestones, and settlements for their own referrals."
      />

      {airtableConnectionFailed ? <p role="alert" className="mb-5 border-l-2 border-accent py-1 pl-3 text-sm">
        Airtable could not be connected. Open the company and review its Airtable settings before trying again.
      </p> : null}

      {justDeleted ? (
        <p
          role="status"
          className="mb-[clamp(14px,1.6vw,20px)] border-l-2 border-accent py-[2px] pl-[10px] text-[12.5px] leading-[1.55] text-ink/72"
        >
          Company deleted.
        </p>
      ) : null}

      <FilterPills
        label="Filter companies"
        basePath="/admin/partners"
        param="status"
        active={status}
        options={FILTERS}
      />

      <FormDisclosure
        summary="Add a company"
        hint="name is all it takes"
        className="mb-[clamp(14px,1.6vw,20px)]"
      >
        <PartnerCompanyForm />
      </FormDisclosure>

      <Panel
        title="Companies"
        meta={total > 0 ? `${activeTotal} active of ${total}` : undefined}
      >
        {companies.length === 0 ? (
          <EmptyState
            headline={
              status ? `No ${status} companies.` : "No partner companies yet."
            }
          >
            Add the company first, then invite their representative. Claims that arrive
            through a referral can be attributed to the company when you accept
            the intake.
          </EmptyState>
        ) : (
          <DataTable
            caption="Partner companies with their rep and claim counts"
            /* 22% of 860, and 31% before that. The sticky identity column was
               266.6px of a 356px scroller at 390 — three quarters of the screen
               spent on the column that never moves, leaving 89px for the other
               five. Scroll padding alone cannot keep a focused control clear of
               a column that wide, because a target wider than what is left of
               the scrollport cannot be placed past the padding at all: the
               browser fits what it can and the control ends up under the sticky
               cell anyway. So the two numbers are chosen together — at 390 the
               scrollport is 356, the sticky column is 189, and CONTACT, the one
               other column holding something focusable, is 19% (163px), which
               fits in the 167px that leaves. */
            stickyColumnWidth={189}
            head={
              <>
                <Th className="w-[22%]">Company</Th>
                <Th className="w-[16%]">Status</Th>
                <Th className="w-[11%]" align="right">
                  Reps
                </Th>
                <Th className="w-[11%]" align="right">
                  Claims
                </Th>
                <Th className="w-[19%]">Contact</Th>
                <Th className="w-[21%]">Added</Th>
              </>
            }
          >
            {companies.map((company) => (
              <Tr key={company.id}>
                <Td>
                  <Link
                    href={`/admin/partners/${company.id}`}
                    className="tap-block block truncate font-medium text-ink no-underline transition-colors duration-150 hover:text-accent"
                  >
                    {company.name}
                  </Link>
                  {company.contactName ? (
                    <CellMeta>{company.contactName}</CellMeta>
                  ) : null}
                </Td>
                <Td>
                  <PartnerStatusPill status={company.status} />
                </Td>
                <Td align="right">
                  <CountCell value={company.repCount} />
                </Td>
                <Td align="right">
                  <CountCell value={company.claimCount} />
                </Td>
                <Td>
                  {company.contactEmail ? (
                    <a
                      href={`mailto:${company.contactEmail}`}
                      className="tap-block block truncate text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                    >
                      {company.contactEmail}
                    </a>
                  ) : company.contactPhone ? (
                    <span className="tabular-nums text-ink/72">
                      {company.contactPhone}
                    </span>
                  ) : (
                    <span className="text-ink/28">—</span>
                  )}
                </Td>
                <Td tone="quiet" className="whitespace-nowrap tabular-nums">
                  {formatDateStamp(company.createdAt)}
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Panel>

      {companies.length > 0 ? (
        <ListPager
          label="Company pages"
          noun="company"
          pluralNoun="companies"
          shown={companies.length}
          total={total}
          prevHref={page > 1 ? pageHref(page - 1) : null}
          nextHref={
            bounds.from + companies.length < total ? pageHref(page + 1) : null
          }
          startHref={page > 1 ? pageHref(1) : null}
        />
      ) : null}
    </>
  );
}
