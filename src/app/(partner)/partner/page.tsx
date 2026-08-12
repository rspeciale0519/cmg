import type { Metadata } from "next";
import {
  PortalCard,
  PortalEmpty,
  PortalShell,
} from "@/components/auth/portal-shell";
import { requireRole } from "@/lib/authz";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referred claims",
  robots: { index: false, follow: false },
};

export default async function PartnerPage() {
  const session = await requireRole("partner");
  const supabase = await createClient();

  // `claim_partner_summaries` is the only claim-shaped relation a partner holds
  // a policy on (spec §4). Reading it unfiltered returns this company's rows and
  // nothing else, and there is no query available here that could return a
  // policy number, a document or a homeowner's contact details — the whitelist
  // is structural, not a projection of a filtered `claims` read.
  const [{ data: summaries }, { data: profile }] = await Promise.all([
    supabase
      .from("claim_partner_summaries")
      .select(
        "claim_id, claim_ref, homeowner_name, property_street, property_city, status, lor_signed_at, filed_at, settled_at, settlement_amount",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", session.userId)
      .maybeSingle(),
  ]);

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return (
    <PortalShell
      surface="Partner portal"
      heading="Claims you referred."
      intro="Status and milestones on every claim your company sent to CMG. Settlement figures appear once a claim settles."
      identity={{ name: name || (session.email ?? "Partner"), role: "Referral partner" }}
    >
      {!summaries || summaries.length === 0 ? (
        <PortalEmpty>
          No referrals on file yet. Claims you refer appear here as soon as CMG
          accepts them.
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
            </PortalCard>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
