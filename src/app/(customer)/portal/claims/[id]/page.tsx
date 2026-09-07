import Link from "next/link";
import { ProgressLadder } from "@/components/portal/progress-ladder";
import { FactList, Panel, PanelBody } from "@/components/portal/surfaces";
import { formatDateOnly, humanizeEnum } from "@/lib/format";
import { progressFor, type StatusHistoryRow } from "@/lib/portal/progress";
import { portalAdjusterName, requirePortalClaim } from "@/lib/portal/queries";
import { emailHref, site, telHref } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { collectPostgrestPages } from "@/lib/supabase/collect-pages";

export const dynamic = "force-dynamic";

/**
 * The screen that has to answer "what is happening and what happens next"
 * without a phone call.
 *
 * What is deliberately absent is as load-bearing as what is here. No settlement
 * figure and no fee percentage: those live in `claim_financials`, which carries
 * no customer policy at all (spec §4), so they are not merely unrendered — they
 * are unreachable from this session. No policy number and no carrier claim
 * number either, though RLS would hand those over on the claims row: the portal
 * has no reason to restate the carrier's own references back at the
 * policyholder, and a screenshot of this page should not be enough to phone the
 * carrier as them.
 */
export default async function ClaimOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { claim } = await requirePortalClaim(id);

  const supabase = await createClient();

  const [history, adjuster] = await Promise.all([
    /* `claim_status_history_select` admits the claim's customer, so this is the
       real transition log rather than a projection of it — which is what lets
       each rung of the ladder carry the date the claim actually reached it. The
       staff `note` column is not selected: those are written for colleagues
       ("Accepted; assigned to Dana Reyes") and are not addressed to the
       homeowner. */
    collectPostgrestPages((from, to) =>
      supabase
        .from("claim_status_history")
        .select("to_status, created_at")
        .eq("claim_id", id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    portalAdjusterName(id),
  ]);

  const progress = progressFor(
    claim.status,
    history as StatusHistoryRow[],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="grid gap-4">
        <Panel title="Where your claim is">
          <PanelBody>
            {progress ? (
              <ProgressLadder progress={progress} />
            ) : (
              /* `customerPhaseFor()` answers null only for `rejected`, which
                 spec §5 says never reaches a homeowner — no invitation is
                 issued for one. Rendered as its own sentence rather than as an
                 empty ladder, because a five-rung diagram with nothing lit on
                 it is a worse answer than a plain one. */
              <p className="max-w-[54ch] text-[15px] leading-[1.75] text-ink/72">
                This claim is closed and is no longer moving. Call us on{" "}
                <a href={telHref} className="text-accent no-underline hover:text-accent-300">
                  {site.phone}
                </a>{" "}
                and we will talk you through where it ended up.
              </p>
            )}
          </PanelBody>
        </Panel>

        <Panel title="The claim">
          <PanelBody>
            <FactList
              items={[
                { term: "Reference", value: <span className="tabular-nums">{claim.claim_ref}</span> },
                { term: "Your insurer", value: claim.carrier ?? "—" },
                { term: "Date of loss", value: formatDateOnly(claim.loss_date) },
                { term: "Cause", value: humanizeEnum(claim.cause) },
              ]}
            />

            <div className="mt-[22px] border-t border-ink/9 pt-[18px]">
              <p className="text-[11px] uppercase leading-[1.4] tracking-[0.14em] text-ink/58">
                What you told us happened
              </p>
              <p className="mt-[8px] max-w-[68ch] whitespace-pre-line text-[14.5px] leading-[1.75] text-ink/72">
                {claim.description}
              </p>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4">
        <Panel title="Who is handling this">
          <PanelBody>
            {adjuster ? (
              <>
                <p className="text-[16px] leading-[1.4] text-ink">{adjuster}</p>
                <p className="mt-[5px] text-[13px] leading-[1.6] text-ink/55">
                  Your public adjuster at CMG
                </p>
              </>
            ) : (
              <p className="text-[14.5px] leading-[1.7] text-ink/72">
                We are assigning your adjuster now. You will see their name here,
                and they will call you.
              </p>
            )}

            {/* `min-h-[44px]` and `flex items-center` rather than bare inline
                links. Measured at 390px these were 23px tall — under the 24px
                floor WCAG 2.5.8 sets and well under the 44px this project holds
                touch targets to. They are also the two most important controls
                on the screen for someone who has given up on reading and wants a
                person, so they are the last place to ship a target you have to
                aim at. */}
            <div className="mt-[20px] grid border-t border-ink/9 pt-[10px] text-[14.5px] leading-[1.6]">
              <a
                href={telHref}
                aria-label={`Call the CMG office at ${site.phone}`}
                className="flex min-h-[44px] items-center text-accent no-underline transition-colors duration-200 hover:text-accent-300"
              >
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/48">
                    CMG office phone
                  </span>
                  {site.phone}
                </span>
              </a>
              <a
                href={emailHref}
                aria-label={`Email the CMG office at ${site.email}`}
                className="flex min-h-[44px] items-center break-words text-accent no-underline transition-colors duration-200 hover:text-accent-300"
              >
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/48">
                    CMG office email
                  </span>
                  {site.email}
                </span>
              </a>
              <p className="mt-[8px] text-[12.5px] leading-[1.6] text-ink/58">
                {site.city} · License #{site.license}
              </p>
            </div>
          </PanelBody>
        </Panel>

        <Panel title="Ask us something">
          <PanelBody>
            <p className="text-[14.5px] leading-[1.7] text-ink/72">
              Anything you are unsure about, put it on the claim and your adjuster
              answers it there — so the answer stays with the file.
            </p>
            <Link
              href={`/portal/claims/${id}/activity`}
              className="mt-[16px] inline-flex min-h-[44px] items-center rounded-md border border-accent px-[20px] text-sm leading-[1.2] font-medium text-accent no-underline transition-colors duration-200 hover:bg-accent/12 active:bg-accent/22"
            >
              Ask a question
            </Link>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
