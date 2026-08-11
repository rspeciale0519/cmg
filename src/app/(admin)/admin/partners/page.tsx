import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { FormDisclosure } from "@/components/admin/disclosure";
import { FilterPills } from "@/components/admin/filter-pills";
import { PartnerCompanyForm } from "@/components/admin/partner-forms";
import { CountCell, PartnerStatusPill } from "@/components/admin/partner-status-pill";
import { loadPartnerSummaries, type PartnerStatus } from "@/lib/admin/partners";
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
  const statusParam = Array.isArray(raw.status) ? raw.status[0] : raw.status;
  const status = statusParam && isPartnerStatus(statusParam) ? statusParam : "";
  const justDeleted = raw.deleted === "1";

  const companies = await loadPartnerSummaries(status || null);
  const active = companies.filter((company) => company.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow={`Owner · ${companies.length} ${companies.length === 1 ? "company" : "companies"}`}
        title="Partner companies."
        lede="Contractors who send work to CMG. Each one gets reps with a portal that shows the status, milestones and settlement of the claims they referred — and nothing else."
      />

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
        meta={
          companies.length > 0
            ? `${active} active of ${companies.length}`
            : undefined
        }
      >
        {companies.length === 0 ? (
          <EmptyState
            headline={
              status ? `No ${status} companies.` : "No partner companies yet."
            }
          >
            Add the contractor first, then invite their rep. Claims that arrive
            through a referral can be attributed to the company when you accept
            the intake.
          </EmptyState>
        ) : (
          <DataTable
            caption="Partner companies with their rep and claim counts"
            head={
              <>
                <Th className="w-[31%]">Company</Th>
                <Th className="w-[14%]">Status</Th>
                <Th className="w-[10%]" align="right">
                  Reps
                </Th>
                <Th className="w-[10%]" align="right">
                  Claims
                </Th>
                <Th className="w-[20%]">Contact</Th>
                <Th className="w-[15%]">Added</Th>
              </>
            }
          >
            {companies.map((company) => (
              <Tr key={company.id}>
                <Td>
                  <Link
                    href={`/admin/partners/${company.id}`}
                    className="block truncate font-medium text-ink no-underline transition-colors duration-150 hover:text-accent"
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
                      className="block truncate text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
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
                <Td className="whitespace-nowrap tabular-nums text-ink/50">
                  {formatDateStamp(company.createdAt)}
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
