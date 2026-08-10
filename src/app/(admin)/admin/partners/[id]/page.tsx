import type { Metadata } from "next";
import Link from "next/link";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
} from "@/components/admin/admin-shell";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import {
  PartnerCompanyForm,
  PartnerDeleteForm,
  PartnerRepInviteForm,
  PartnerStatusForm,
} from "@/components/admin/partner-forms";
import { PartnerStatusPill } from "@/components/admin/partner-status-pill";
import { ClaimRef, StatusPill } from "@/components/admin/status-pill";
import { loadPartnerDetail } from "@/lib/admin/partners";
import { requireRole } from "@/lib/authz";
import { formatDateStamp, formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await requireRole("owner");
  const { id } = await params;
  const { company } = await loadPartnerDetail(id);

  return { title: company.name, robots: { index: false, follow: false } };
}

/**
 * One company, top to bottom: who they are, who their people are, what they have
 * sent us, and how the relationship ends.
 *
 * The last section is where the screen does its real teaching. Spec §4 gives the
 * owner CRUD, but the *designed* way to end a partnership is `status =
 * 'inactive'` — which is not a label, because
 * `private.current_partner_company_id()` joins through `partner_companies` and
 * requires the company to be active, so every rep loses the portal on their next
 * request while the claims they referred keep their attribution. Deletion exists
 * for a company that should never have been created, and
 * `guard_partner_company_delete()` refuses it the moment a rep profile points at
 * it. The panel says both of those things next to the two controls rather than
 * letting an owner discover the second one as an error.
 */
export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("owner");
  const { id } = await params;
  const { company, reps, pendingInvites, claims } = await loadPartnerDetail(id);

  const activeReps = reps.filter((rep) => rep.isActive).length;

  return (
    <>
      <p className="pb-[10px] text-[12.5px] leading-[1.4]">
        <Link
          href="/admin/partners"
          className="text-ink/50 no-underline transition-colors duration-150 hover:text-accent"
        >
          ← Partner companies
        </Link>
      </p>

      <PageHeader
        eyebrow={`Owner · added ${formatDateStamp(company.createdAt)}`}
        title={company.name}
        lede={
          company.status === "active"
            ? "Active. Reps can sign in and follow the claims they referred."
            : "Inactive. Reps keep their accounts but see nothing — the projection is scoped to active companies."
        }
        actions={<PartnerStatusPill status={company.status} />}
      />

      <div className="grid gap-[clamp(16px,2vw,24px)]">
        <Panel title="Company details" meta={`Updated ${formatRelative(company.updatedAt)}`}>
          <PanelBody>
            {/* Keyed on updatedAt so a saved edit re-seeds the uncontrolled
                fields rather than snapping back to the first render's values —
                see PartnerCompanyForm. */}
            <PartnerCompanyForm
              key={company.updatedAt}
              companyId={company.id}
              initial={{
                name: company.name,
                contactName: company.contactName ?? "",
                contactEmail: company.contactEmail ?? "",
                contactPhone: company.contactPhone ?? "",
                notes: company.notes ?? "",
              }}
            />
          </PanelBody>
        </Panel>

        <Panel
          title="Representatives"
          meta={
            reps.length === 0
              ? "none yet"
              : `${activeReps} active of ${reps.length}`
          }
        >
          {reps.length === 0 ? (
            <EmptyState headline="No reps have accepted an invitation yet.">
              A rep gets their own sign-in and sees the status, milestones and
              settlement figure for the claims this company referred.
            </EmptyState>
          ) : (
            <DataTable
              caption={`Representatives of ${company.name}`}
              head={
                <>
                  <Th className="w-[30%]">Rep</Th>
                  <Th className="w-[30%]">Email</Th>
                  <Th className="w-[18%]">Phone</Th>
                  <Th className="w-[22%]">Last signed in</Th>
                </>
              }
            >
              {reps.map((rep) => (
                <Tr key={rep.id}>
                  <Td className="max-w-0">
                    <span className="block truncate font-medium text-ink">
                      {rep.name}
                    </span>
                    {rep.isActive ? null : <CellMeta>Deactivated</CellMeta>}
                  </Td>
                  <Td className="max-w-0">
                    {rep.email ? (
                      <a
                        href={`mailto:${rep.email}`}
                        className="block truncate text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                      >
                        {rep.email}
                      </a>
                    ) : (
                      <span className="text-ink/28">—</span>
                    )}
                  </Td>
                  <Td className="tabular-nums">{rep.phone ?? "—"}</Td>
                  <Td className="whitespace-nowrap text-ink/50">
                    {rep.lastSignInAt ? formatRelative(rep.lastSignInAt) : "Never"}
                  </Td>
                </Tr>
              ))}
            </DataTable>
          )}

          <div className="border-t border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[clamp(14px,1.6vw,18px)]">
            <h3 className="mb-[12px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/45">
              Invite a rep
            </h3>
            <PartnerRepInviteForm companyId={company.id} />
          </div>

          {pendingInvites.length > 0 ? (
            <div className="border-t border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[clamp(14px,1.6vw,18px)]">
              <h3 className="mb-[10px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/45">
                Awaiting acceptance
              </h3>
              <ul className="grid gap-[7px]">
                {pendingInvites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-baseline gap-x-3 text-[13px] leading-[1.5]"
                  >
                    <span className="text-ink/78">{invite.email}</span>
                    <span className="text-[12px] text-ink/42">
                      expires {formatDateStamp(invite.expiresAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel
          title="Attributed claims"
          meta={claims.length > 0 ? `${claims.length} shown, newest first` : undefined}
        >
          {claims.length === 0 ? (
            <EmptyState headline="No claims are attributed to this company.">
              A claim picks up its company when you accept the intake, or when a
              rep refers one from their own portal.
            </EmptyState>
          ) : (
            <DataTable
              caption={`Claims referred by ${company.name}`}
              head={
                <>
                  <Th className="w-[20%]">Reference</Th>
                  <Th className="w-[42%]">Property</Th>
                  <Th className="w-[22%]">Status</Th>
                  <Th className="w-[16%]">Opened</Th>
                </>
              }
            >
              {claims.map((claim) => (
                <Tr key={claim.id}>
                  <Td>
                    <Link
                      href={`/admin/claims/${claim.id}`}
                      className="text-ink no-underline transition-colors duration-150 hover:text-accent"
                    >
                      <ClaimRef value={claim.claimRef} />
                    </Link>
                  </Td>
                  <Td className="max-w-0">
                    <span className="block truncate">{claim.street}</span>
                    <CellMeta>{claim.city}</CellMeta>
                  </Td>
                  <Td>
                    <StatusPill status={claim.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-ink/50">
                    {formatDateStamp(claim.createdAt)}
                  </Td>
                </Tr>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel title="Ending the relationship">
          <PanelBody className="grid gap-[clamp(18px,2.2vw,26px)] lg:grid-cols-2">
            <div>
              <h3 className="text-[13px] font-medium leading-[1.4] text-ink/85">
                {company.status === "active" ? "Deactivate" : "Reactivate"}
              </h3>
              <p className="mb-[12px] mt-[6px] max-w-[52ch] text-[12.5px] leading-[1.65] text-ink/55">
                {company.status === "active"
                  ? "The normal way to end a partnership. Every rep stops seeing anything on their next request, because the portal projection is scoped to active companies. The claims they referred keep the attribution, so the history stays intact."
                  : "Restores portal access for every rep still linked to this company."}
              </p>
              <PartnerStatusForm companyId={company.id} status={company.status} />
            </div>

            <div className="border-t border-ink/10 pt-[clamp(18px,2.2vw,26px)] lg:border-l lg:border-t-0 lg:pl-[clamp(18px,2.2vw,26px)] lg:pt-0">
              <h3 className="text-[13px] font-medium leading-[1.4] text-[#E8A98D]">
                Delete
              </h3>
              <p className="mb-[12px] mt-[6px] max-w-[52ch] text-[12.5px] leading-[1.65] text-ink/55">
                For a company that should never have been created — a duplicate,
                a typo. The database refuses it while any rep profile points here,
                and refuses to leave claims stranded. It cannot be undone.
              </p>
              <PartnerDeleteForm
                companyId={company.id}
                companyName={company.name}
                repCount={reps.length}
              />
            </div>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
