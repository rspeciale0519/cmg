import type { Metadata } from "next";
import Link from "next/link";
import {
  BackLink,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
} from "@/components/admin/admin-shell";
import { CellMeta, DataTable, Td, Th, Tr } from "@/components/admin/data-table";
import { ListPager, listMeta } from "@/components/admin/list-pager";
import {
  PartnerCompanyForm,
  PartnerDeleteForm,
  PartnerRepInviteForm,
  PartnerStatusForm,
} from "@/components/admin/partner-forms";
import { PartnerStatusPill } from "@/components/admin/partner-status-pill";
import { ClaimRef, StatusPill } from "@/components/admin/status-pill";
import { loadPartnerDetail, PARTNER_REPS_PAGE_SIZE } from "@/lib/admin/partners";
import { pageCursors } from "@/lib/admin/audit-range";
import {
  clampPage,
  firstParam,
  formatTimeCursor,
  offsetBounds,
  parsePageNumber,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/admin/paging";
import { hasRole, NOT_FOUND_TITLE, requireRole } from "@/lib/authz";
import { formatDateStamp, formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The tab title only, resolved without throwing — see the same note on
 * `claims/[id]/layout.tsx`. `loadPartnerDetail` calls `notFound()` for a
 * missing id, which is correct for the page and wrong for metadata: it
 * abandoned title resolution and left the tab blank, so one 404 produced three
 * different titles across the workspace. The page below still refuses; this
 * only decides what the tab says while it does.
 */
async function companyNameForTitle(id: string): Promise<string | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_companies")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  return data?.name ?? null;
}

/**
 * `requireRole` used to run here and `notFound()` out of metadata resolution
 * entirely, which left the tab title empty — a third spelling of the same 404
 * beside "Page not found" from an unrouted path and the company name from a real
 * one. `metadataForRole` answers with a string instead, so a non-owner and a
 * company that is not there read identically. The page below still refuses.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  return {
    title: (await hasRole("owner"))
      ? ((await companyNameForTitle(id)) ?? NOT_FOUND_TITLE)
      : NOT_FOUND_TITLE,
    robots: { index: false, follow: false },
  };
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("owner");
  const { id } = await params;
  const raw = await searchParams;

  const claimsForward = parseTimeCursor(firstParam(raw, "claims"));
  const claimsBackward = claimsForward
    ? null
    : parseTimeCursor(firstParam(raw, "claimsPrev"));
  const claimsCursor = claimsForward ?? claimsBackward;
  const claimsReversed = claimsBackward !== null;

  const repsPageAsked = parsePageNumber(firstParam(raw, "reps"));
  const firstBounds = offsetBounds(1, PARTNER_REPS_PAGE_SIZE);

  const paging = {
    claimsClause: claimsCursor
      ? timeKeysetClause(claimsReversed ? "asc" : "desc", claimsCursor)
      : null,
    claimsReversed,
  };

  // The rep window is counted before it is clamped, so a stale `?reps=9` lands
  // on the last page that exists rather than on an empty table.
  const firstPass = await loadPartnerDetail(id, {
    ...paging,
    repsFrom: firstBounds.from,
    repsTo: firstBounds.to,
  });
  const repsPage = clampPage(repsPageAsked, firstPass.repTotal, PARTNER_REPS_PAGE_SIZE);
  const repBounds = offsetBounds(repsPage, PARTNER_REPS_PAGE_SIZE);
  const detail =
    repsPage === 1
      ? firstPass
      : await loadPartnerDetail(id, {
          ...paging,
          repsFrom: repBounds.from,
          repsTo: repBounds.to,
        });

  const { company, reps, pendingInvites, claims } = detail;
  const intakeUrl = new URL("/file-a-claim", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  intakeUrl.searchParams.set("ref", company.intakeReferralCode);

  const { olderThan: claimsNext, newerThan: claimsPrev } = pageCursors({
    ids: claims.map((claim) =>
      formatTimeCursor(timeCursorFrom({ id: claim.id, created_at: claim.createdAt })),
    ),
    hasMore: detail.claimsHasMore,
    ascending: claimsReversed,
    cameFromCursor: claimsCursor !== null,
  });

  /**
   * Each list keeps the other's position, so paging the claims does not throw
   * the rep table back to its first page.
   */
  const base = `/admin/partners/${id}`;
  const repsHeld: [string, string][] = repsPage > 1 ? [["reps", String(repsPage)]] : [];
  const claimsHeld: [string, string][] = claimsForward
    ? [["claims", formatTimeCursor(claimsForward)]]
    : claimsBackward
      ? [["claimsPrev", formatTimeCursor(claimsBackward)]]
      : [];
  const build = (pairs: [string, string][]) => {
    const query = new URLSearchParams(pairs).toString();
    return query ? `${base}?${query}` : base;
  };
  const repsHref = (target: number) =>
    build(target > 1 ? [["reps", String(target)], ...claimsHeld] : claimsHeld);
  const claimsHref = (key: "claims" | "claimsPrev", value: string) =>
    build([...repsHeld, [key, value]]);

  return (
    <>
      <BackLink href="/admin/partners">Partner companies</BackLink>

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
        <Panel title="Vendor intake link">
          <PanelBody>
            <p className="mb-3 text-sm text-ink/70">
              Share this link with this vendor. It opens the shared form and records the vendor internally.
              It does not grant access to claims or other vendors.
            </p>
            {company.status === "active" ? (
              <a className="break-all text-sm underline" href={intakeUrl.toString()}>{intakeUrl.toString()}</a>
            ) : <p className="text-sm">This vendor is inactive. Its link cannot start a new intake.</p>}
          </PanelBody>
        </Panel>
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
            detail.repTotal === 0
              ? "none yet"
              : `${detail.activeRepTotal} active of ${detail.repTotal}`
          }
        >
          {reps.length === 0 ? (
            <EmptyState headline="No reps have accepted an invitation yet.">
              A rep gets their own sign-in and sees the status, milestones and
              settlement figure for the claims this company referred.
            </EmptyState>
          ) : (
            <>
            <DataTable
              stickyColumnWidth={224}
              caption={`Representatives of ${company.name}`}
              head={
                <>
                  <Th className="w-[26%]">Rep</Th>
                  <Th className="w-[32%]">Email</Th>
                  <Th className="w-[20%]">Phone</Th>
                  <Th className="w-[22%]">Last signed in</Th>
                </>
              }
            >
              {reps.map((rep) => (
                <Tr key={rep.id}>
                  <Td>
                    <span className="block truncate font-medium text-ink">
                      {rep.name}
                    </span>
                    {rep.isActive ? null : <CellMeta>Deactivated</CellMeta>}
                  </Td>
                  <Td>
                    {rep.email ? (
                      <a
                        href={`mailto:${rep.email}`}
                        className="tap-block block truncate text-ink/72 no-underline transition-colors duration-150 hover:text-accent"
                      >
                        {rep.email}
                      </a>
                    ) : (
                      <span className="text-ink/28">—</span>
                    )}
                  </Td>
                  <Td className="tabular-nums">{rep.phone ?? "—"}</Td>
                  <Td tone="quiet" className="whitespace-nowrap tabular-nums">
                    {rep.lastSignInAt ? formatRelative(rep.lastSignInAt) : "Never"}
                  </Td>
                </Tr>
              ))}
            </DataTable>

            <ListPager
              label="Representative pages"
              noun="rep"
              pluralNoun="reps"
              placement="footer"
              shown={reps.length}
              total={detail.repTotal}
              prevHref={repsPage > 1 ? repsHref(repsPage - 1) : null}
              nextHref={
                repBounds.from + reps.length < detail.repTotal
                  ? repsHref(repsPage + 1)
                  : null
              }
              startHref={repsPage > 1 ? repsHref(1) : null}
            />
            </>
          )}

          <div className="border-t border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[clamp(14px,1.6vw,18px)]">
            <h3 className="mb-[12px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55">
              Invite a rep
            </h3>
            <PartnerRepInviteForm companyId={company.id} />
          </div>

          {pendingInvites.length > 0 ? (
            <div className="border-t border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[clamp(14px,1.6vw,18px)]">
              <h3 className="mb-[10px] text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/55">
                Awaiting acceptance
              </h3>
              <ul className="grid gap-[7px]">
                {pendingInvites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-baseline gap-x-3 text-[13px] leading-[1.5]"
                  >
                    <span className="text-ink/78">{invite.email}</span>
                    <span className="text-[12px] text-ink/55">
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
          meta={
            detail.claimTotal > 0
              ? `${listMeta(claims.length, detail.claimTotal, "claim", "claims")}, newest first`
              : undefined
          }
        >
          {claims.length === 0 ? (
            <EmptyState headline="No claims are attributed to this company.">
              A claim picks up its company when you accept the intake, or when a
              rep refers one from their own portal.
            </EmptyState>
          ) : (
            <>
            <DataTable
              stickyColumnWidth={172}
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
                      className="tap-block text-ink no-underline transition-colors duration-150 hover:text-accent"
                    >
                      <ClaimRef value={claim.claimRef} />
                    </Link>
                  </Td>
                  <Td>
                    <span className="block truncate">{claim.street}</span>
                    <CellMeta>{claim.city}</CellMeta>
                  </Td>
                  <Td>
                    <StatusPill status={claim.status} />
                  </Td>
                  <Td tone="quiet" className="whitespace-nowrap tabular-nums">
                    {formatDateStamp(claim.createdAt)}
                  </Td>
                </Tr>
              ))}
            </DataTable>

            <ListPager
              label="Attributed claim pages"
              noun="claim"
              pluralNoun="claims"
              placement="footer"
              shown={claims.length}
              total={detail.claimTotal}
              prevHref={claimsPrev ? claimsHref("claimsPrev", claimsPrev) : null}
              nextHref={claimsNext ? claimsHref("claims", claimsNext) : null}
              startHref={claimsCursor ? build(repsHeld) : null}
            />
            </>
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
                repCount={detail.repTotal}
              />
            </div>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
