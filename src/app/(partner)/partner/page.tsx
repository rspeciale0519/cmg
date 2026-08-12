import type { Metadata } from "next";
import Link from "next/link";
import {
  PortalCard,
  PortalEmpty,
  PortalShell,
} from "@/components/auth/portal-shell";
import { formatDateStamp, formatMoney } from "@/lib/format";
import { partnerIdentity } from "@/lib/portal/partner-identity";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The three moments §4 lets a partner see, in the order they happen, with the
 * ones that have not happened yet left out.
 *
 * These are exactly the columns `claim_partner_summaries` exposes — the
 * whitelist is the view, not this list — so nothing here can widen what a
 * contractor reads.
 */
function milestonesOf(summary: {
  lor_signed_at: string | null;
  filed_at: string | null;
  settled_at: string | null;
}): { label: string; at: string }[] {
  return [
    { label: "LOR signed", at: summary.lor_signed_at },
    { label: "Filed", at: summary.filed_at },
    { label: "Settled", at: summary.settled_at },
  ].filter((entry): entry is { label: string; at: string } => entry.at !== null);
}

export const metadata: Metadata = {
  title: "Referred claims",
  robots: { index: false, follow: false },
};

export default async function PartnerPage() {
  const supabase = await createClient();

  // `claim_partner_summaries` is the only claim-shaped relation a partner holds
  // a policy on (spec §4). Reading it unfiltered returns this company's rows and
  // nothing else, and there is no query available here that could return a
  // policy number, a document or a homeowner's contact details — the whitelist
  // is structural, not a projection of a filtered `claims` read.
  const [{ data: summaries }, identity] = await Promise.all([
    supabase
      .from("claim_partner_summaries")
      .select(
        "claim_id, claim_ref, homeowner_name, property_street, property_city, status, lor_signed_at, filed_at, settled_at, settlement_amount",
      )
      .order("updated_at", { ascending: false }),
    // Shared with this surface's 404, which used to name the same person
    // differently — see `partnerIdentity`.
    partnerIdentity(),
  ]);

  return (
    <PortalShell
      surface="Partner portal"
      heading="Claims you referred."
      intro="Status and milestones on every claim your company sent to CMG. Settlement figures appear once a claim settles."
      identity={identity}
    >
      {/* The route to the surface's only write. It sits above the list rather
          than in the header, because `PortalShell`'s header is the identity and
          the sign-out and is shared with the customer portal — and because a rep
          arriving here to send a job should not have to read a list of other
          people's roofs first. */}
      <p className="mb-[clamp(20px,3vh,28px)]">
        <Link
          href="/partner/refer"
          className="inline-flex min-h-11 items-center rounded-md border border-accent px-5 text-sm leading-[1.55] font-medium text-accent no-underline transition-colors duration-200 hover:bg-accent/12"
        >
          Refer a claim
        </Link>
      </p>

      {!summaries || summaries.length === 0 ? (
        <PortalEmpty>
          {/* "as soon as CMG accepts them" was wrong the moment this surface
              could create one: public.refresh_claim_partner_summary() projects a
              claim the instant it carries a partner_company_id, so a referral
              sent from this portal appears here immediately, reading "new
              intake". */}
          No referrals on file yet. A claim you refer appears here straight away,
          and its status moves as CMG works it.
        </PortalEmpty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map((summary) => (
            <PortalCard
              key={summary.claim_id}
              title={summary.claim_ref}
              meta={summary.status.replace(/_/g, " ")}
            >
              <p className="text-ink">{summary.homeowner_name ?? "Homeowner"}</p>
              <p className="mt-2">
                {summary.property_street}, {summary.property_city}
              </p>
              {/* `formatMoney`, not a local formatter. This page had its own
                  `Intl.NumberFormat` at `maximumFractionDigits: 0`, which rounds
                  half *up*: a settlement recorded as $412,500.50 was reported to
                  the referring contractor as $412,501 — more than the business
                  received — and $9,999,999,999.99, the product's own ceiling,
                  printed as $10,000,000,000. `format.ts` states the rule this
                  broke: a figure that is not round keeps its cents, because
                  rounding a settlement in the UI is how two systems come to
                  disagree about what was paid. This is the only reading of that
                  number the partner ever gets. */}
              <p className="mt-2">
                {summary.settlement_amount === null
                  ? "Settlement reported once the claim settles."
                  : `Settled at ${formatMoney(summary.settlement_amount)}`}
              </p>

              {/* The milestones the intro promises. The three timestamps were
                  selected by the query above and then never rendered, so a
                  contractor was told this page carries "status and milestones"
                  and handed one word of status: the seed's own row holds an LOR
                  signed on 19 Feb, a filing on 4 Mar and a settlement on 18 Jun,
                  and `main` contained no `<time>` at all.

                  Nulls are dropped rather than shown as pending, because the
                  three are strictly ordered — a claim cannot be filed before the
                  LOR is signed — so the last one present is also the position,
                  and a row of dashes would say less than the dates do. */}
              {milestonesOf(summary).length > 0 ? (
                <dl className="mt-3 grid gap-1 text-[13px] leading-[1.5]">
                  {milestonesOf(summary).map((milestone) => (
                    <div key={milestone.label} className="flex gap-x-3">
                      <dt className="min-w-[86px] text-ink/58">{milestone.label}</dt>
                      <dd className="tabular-nums text-ink/78">
                        <time dateTime={milestone.at}>
                          {formatDateStamp(milestone.at)}
                        </time>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </PortalCard>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
