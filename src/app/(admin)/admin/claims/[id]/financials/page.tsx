import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel, PanelBody } from "@/components/admin/admin-shell";
import { Fact, FactList } from "@/components/admin/data-table";
import { FinancialsForm } from "@/components/admin/financials-form";
import { adminTitle, NOT_FOUND_TITLE } from "@/lib/authz";
import { claimTitleContext, loadClaimContext } from "@/lib/claims/queries";
import { formatMoney, formatPercent, formatTimestamp } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The claim layout above this one titles every tab with the reference, which is
 * right for the five tabs that are there for everyone who can open the claim.
 * This one is not: it 404s for an assistant, and it inherited the layout's
 * title while doing so — the workspace 404 in the body and `CMG-2026-0001 · CMG
 * claims desk` in the tab strip. Together those say the claim exists, a
 * Financials screen exists, and this account may not have it, which is exactly
 * the disclosure `notFound()` is used here to avoid (spec §7.9) and exactly
 * what `metadataForRole` already prevents on the role-gated routes.
 *
 * A capability gate is not a role gate — an adjuster sees this tab on their own
 * claims and not on anyone else's — so it is asked as a capability, on the same
 * non-throwing read the layout uses.
 *
 * When the tab *is* theirs this returns no title at all and the layout's claim
 * reference stands, which is what the other five tabs do. The refusal is
 * `absolute` and re-applies the suffix by hand: the layout above already
 * consumed `/admin`'s `title.template` on the reference, so a bare string here
 * would render "Page not found" while `/admin/staff` and an unrouted path both
 * say "Page not found · CMG claims desk". Three tabs, one refusal, one spelling.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const context = await claimTitleContext(id);
  const robots = { index: false, follow: false } as const;

  // Named like its five siblings when the tab exists; the layout's template
  // adds the claim reference.
  if (context?.can.canSeeFinancials) return { title: "Financials", robots };

  return { title: { absolute: adminTitle(NOT_FOUND_TITLE) }, robots };
}

/**
 * `claim_financials` carries no policy for an assistant at all — RLS denies
 * them outright — so this page is not merely blank for them, it is absent. The
 * tab is not rendered in the layout and the route itself 404s, which is the
 * same answer an unauthorised claim id gets (spec §7.9).
 *
 * That is the difference between an empty panel and a missing page: an empty
 * money panel states "no settlement has been recorded", which for an assistant
 * looking at a settled claim is false.
 */
export default async function FinancialsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { claim, can } = await loadClaimContext(id);

  if (!can.canSeeFinancials) notFound();

  const supabase = await createClient();
  const { data: financials } = await supabase
    .from("claim_financials")
    .select(
      "settlement_amount, fee_percent, notes, updated_at, updater:profiles!claim_financials_updated_by_fkey(first_name, last_name)",
    )
    .eq("claim_id", id)
    .maybeSingle();

  const amount = financials?.settlement_amount ?? null;
  const fee = financials?.fee_percent ?? null;
  const updater = financials?.updater
    ? `${financials.updater.first_name ?? ""} ${financials.updater.last_name ?? ""}`.trim()
    : null;

  const numericAmount = amount === null ? null : Number(amount);
  const numericFee = fee === null ? null : Number(fee);
  const feeValue =
    numericAmount !== null && numericFee !== null
      ? (numericAmount * numericFee) / 100
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <Panel title="Settlement">
        <PanelBody>
          <FinancialsForm
            claimId={id}
            settlementAmount={numericAmount}
            feePercent={numericFee}
            notes={financials?.notes ?? null}
          />
        </PanelBody>
      </Panel>

      <div className="grid gap-4">
        <Panel title="On record">
          <PanelBody>
            <FactList columns={1}>
              <Fact label="Settlement amount">
                <span className="tabular-nums text-[17px]">
                  {formatMoney(numericAmount)}
                </span>
              </Fact>
              <Fact label="Fee percent">
                <span className="tabular-nums">{formatPercent(numericFee)}</span>
              </Fact>
              <Fact label="CMG fee">
                <span className="tabular-nums">{formatMoney(feeValue)}</span>
              </Fact>
              <Fact label="Last changed">
                {financials?.updated_at ? (
                  <>
                    {formatTimestamp(financials.updated_at)}
                    {updater ? (
                      <span className="block text-[13px] text-ink/58">{updater}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-ink/58">Never</span>
                )}
              </Fact>
            </FactList>
          </PanelBody>
        </Panel>

        <Panel title="Who can see this">
          <PanelBody>
            <p className="text-[12.5px] leading-[1.7] text-ink/55">
              Settlement figures live in their own table with their own policies:
              the owner and the adjuster {claim.claimRef} is assigned to, and
              nobody else. Assistants hold no permission on it, homeowners never
              see it here, and the referring contractor learns the figure only
              once the claim reaches settled — through the partner summary, not
              through this page.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
