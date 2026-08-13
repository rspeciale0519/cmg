import type { Metadata } from "next";
import Link from "next/link";
import { PortalCard, PortalEmpty, PortalShell } from "@/components/auth/portal-shell";
import { ListPager } from "@/components/admin/list-pager";
import { PartnerNav } from "@/components/partner/partner-nav";
import { formatDateStamp, formatMoney, humanizeEnum } from "@/lib/format";
import { clampPage, firstParam, offsetBounds, parsePageNumber } from "@/lib/paging";
import {
  loadPartnerClaimPage,
  PARTNER_CLAIMS_PAGE_SIZE,
} from "@/lib/partner/queries";
import { partnerMilestones } from "@/lib/partner/presentation";
import { partnerIdentity } from "@/lib/portal/partner-identity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referred claims",
  robots: { index: false, follow: false },
};

export default async function PartnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const [identity, firstPass] = await Promise.all([
    partnerIdentity(),
    loadPartnerClaimPage(0, PARTNER_CLAIMS_PAGE_SIZE - 1),
  ]);
  const page = clampPage(
    parsePageNumber(firstParam(raw, "page")),
    firstPass.total,
    PARTNER_CLAIMS_PAGE_SIZE,
  );
  const bounds = offsetBounds(page, PARTNER_CLAIMS_PAGE_SIZE);
  const result = page === 1
    ? firstPass
    : await loadPartnerClaimPage(bounds.from, bounds.to);

  const pageHref = (target: number) =>
    target > 1 ? `/partner?page=${target}` : "/partner";
  const lastPage = Math.max(1, Math.ceil(result.total / PARTNER_CLAIMS_PAGE_SIZE));

  return (
    <PortalShell
      surface="Partner portal"
      heading="Claims you referred."
      intro="Status, milestones and partner-safe updates for every claim your company sent to CMG. Settlement appears only after it is agreed."
      identity={identity}
    >
      <PartnerNav />

      {result.summaries.length === 0 ? (
        <PortalEmpty>
          No referrals on file yet. Use “Refer a claim” and it will appear here
          straight away while CMG reviews it.
        </PortalEmpty>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {result.summaries.map((summary) => {
              const milestones = partnerMilestones(summary);
              return (
                <PortalCard
                  key={summary.claim_id}
                  title={summary.claim_ref}
                  meta={humanizeEnum(summary.status)}
                >
                  <p className="text-ink">{summary.homeowner_name ?? "Homeowner"}</p>
                  <p className="mt-2">
                    {[summary.property_street, summary.property_city].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-2">
                    {summary.settlement_amount === null
                      ? "Settlement reported once the claim settles."
                      : `Settled at ${formatMoney(summary.settlement_amount)}`}
                  </p>
                  {milestones.length > 0 ? (
                    <dl className="mt-3 grid gap-1 text-[13px]">
                      {milestones.map((milestone) => (
                        <div key={milestone.label} className="flex gap-3">
                          <dt className="min-w-[86px] text-ink/58">{milestone.label}</dt>
                          <dd>
                            <time dateTime={milestone.at}>{formatDateStamp(milestone.at)}</time>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <Link
                    href={`/partner/claims/${summary.claim_id}`}
                    className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-accent no-underline hover:text-accent-300"
                  >
                    View claim and activity →
                  </Link>
                </PortalCard>
              );
            })}
          </div>

          <ListPager
            shown={result.summaries.length}
            total={result.total}
            noun="claim"
            pluralNoun="claims"
            label="Referred claim pages"
            prevHref={page > 1 ? pageHref(page - 1) : null}
            nextHref={page < lastPage ? pageHref(page + 1) : null}
            startHref={page > 1 ? "/partner" : null}
          />
        </>
      )}
    </PortalShell>
  );
}
