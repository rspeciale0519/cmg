import type { Metadata } from "next";
import { EmptyState, PageHeader, Panel } from "@/components/admin/admin-shell";
import { Fact, FactList } from "@/components/admin/data-table";
import { IntakeActions } from "@/components/admin/intake-actions";
import { ListPager } from "@/components/admin/list-pager";
import { ClaimRef } from "@/components/admin/status-pill";
import { pageCursors } from "@/lib/admin/audit-range";
import {
  firstParam,
  formatTimeCursor,
  pageSlice,
  parseTimeCursor,
  timeCursorFrom,
  timeKeysetClause,
} from "@/lib/admin/paging";
import { claimCapabilities } from "@/lib/claims/capabilities";
import { loadAdjusters, loadPartnerCompanies } from "@/lib/claims/queries";
import { requireStaff } from "@/lib/authz";
import {
  formatAddressLine,
  formatDateOnly,
  formatRelative,
  formatTimeOnly,
  humanizeEnum,
  NOT_SUPPLIED,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadClaimantSummaries } from "@/lib/claims/claimants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Intake queue",
  robots: { index: false, follow: false },
};

/**
 * Twenty. A card here is a heading, nine facts and a description, so twenty of
 * them is already a long screen — and the query had no limit at all, which
 * means PostgREST's `max_rows` of 1000 was the real one. After a storm this is
 * the list that grows fastest.
 */
const PAGE_SIZE = 20;

/**
 * Cards, not a table. Triage is a judgement made against the whole submission —
 * the loss date beside the carrier tenure, the description beside the address —
 * and a table row cannot hold a paragraph. Newest first, because a storm
 * produces a burst of intakes and the newest are the ones nobody has looked at.
 */
export default async function IntakeQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaff("/admin/intake");
  const raw = await searchParams;
  const supabase = await createClient();

  const forward = parseTimeCursor(firstParam(raw, "next"));
  const backward = forward ? null : parseTimeCursor(firstParam(raw, "prev"));
  const cursor = forward ?? backward;
  const reversed = backward !== null;

  let queueQuery = supabase
    .from("claims")
    .select(
      `id, claim_ref, created_at, assigned_adjuster_id,
       property_street, property_street2, property_city, property_state, property_zip,
       carrier, policy_number, carrier_tenure, prior_roof_claim, prior_outcome,
       loss_date, loss_time, cause, description,
       requested_adjuster, referrer_name, referrer_email`,
    )
    .eq("status", "new_intake")
    .order("created_at", { ascending: reversed })
    .order("id", { ascending: reversed })
    .limit(PAGE_SIZE + 1);

  if (cursor) {
    queueQuery = queueQuery.or(timeKeysetClause(reversed ? "asc" : "desc", cursor));
  }

  const [queue, count, adjusters, partners] = await Promise.all([
    queueQuery,
    // The same tally the nav badge and the dashboard's pipeline strip print, so
    // the three numbers on the three screens are one number.
    supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "new_intake"),
    loadAdjusters(),
    loadPartnerCompanies(),
  ]);

  const page = pageSlice(queue.data ?? [], PAGE_SIZE, reversed);
  const claims = page.rows;
  const claimantRows = await loadClaimantSummaries(claims.map((claim) => claim.id));
  const total = count.count ?? claims.length;

  const { olderThan: nextCursor, newerThan: prevCursor } = pageCursors({
    ids: claims.map((claim) => formatTimeCursor(timeCursorFrom(claim))),
    hasMore: page.hasMore,
    ascending: reversed,
    cameFromCursor: cursor !== null,
  });

  const pageHref = (key: "next" | "prev", value: string) =>
    `/admin/intake?${key}=${value}`;

  return (
    <>
      <PageHeader
        eyebrow={`${total} waiting`}
        title="Intake queue."
        lede="Submissions from the public claim form, newest first. Accepting assigns an adjuster, moves the claim to under review and invites the homeowner to their portal. Declining archives it and sends nothing."
      />

      {claims.length === 0 ? (
        <Panel>
          <EmptyState headline="The queue is clear.">
            New submissions from /file-a-claim arrive here within seconds of being
            sent.
          </EmptyState>
        </Panel>
      ) : (
        <>
        <div className="grid gap-4">
          {claims.map((claim) => {
            const primary =
              claimantRows.get(claim.id)?.find((person) => person.is_primary) ??
              claimantRows.get(claim.id)?.[0];
            const others = (claimantRows.get(claim.id) ?? []).filter(
              (person) => person !== primary,
            );
            const can = claimCapabilities(
              { userId: session.userId, role: session.role },
              { assignedAdjusterId: claim.assigned_adjuster_id },
            );

            return (
              <article
                key={claim.id}
                id={claim.id}
                className="border border-ink/11 bg-surface/38 target:border-accent/50"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[13px]">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-medium leading-[1.3] tracking-[-0.01em]">
                      {primary
                        ? `${primary.first_name} ${primary.last_name}`.trim()
                        : "Unnamed homeowner"}
                    </h2>
                    <p className="mt-[3px] text-[12.5px] leading-[1.45] text-ink/58">
                      {formatAddressLine({
                        street: claim.property_street,
                        street2: claim.property_street2,
                        city: claim.property_city,
                        state: claim.property_state,
                        zip: claim.property_zip,
                      })}
                    </p>
                  </div>
                  <p className="flex items-baseline gap-3 text-[12px] leading-[1.4] text-ink/55">
                    <ClaimRef value={claim.claim_ref} className="text-accent/85" />
                    <span>submitted {formatRelative(claim.created_at)}</span>
                  </p>
                </header>

                <div className="px-[clamp(14px,1.6vw,20px)] py-[16px]">
                  <FactList columns={3}>
                    <Fact label="Date of loss">
                      <span className="tabular-nums">
                        {formatDateOnly(claim.loss_date)}
                      </span>
                      {/* Dropped rather than dashed when it is absent: a
                          referral asks for the date only, and "· —" beside the
                          date reads as a value that failed to load. */}
                      {claim.loss_time ? (
                        <span className="text-ink/55">
                          {" "}
                          · {formatTimeOnly(claim.loss_time)}
                        </span>
                      ) : null}
                    </Fact>
                    <Fact label="Cause">{humanizeEnum(claim.cause)}</Fact>
                    {/* A partner referral has no policy side at all — §6 does
                        not ask the rep for it, and this is the card the operator
                        decides against, so the gap is stated in words. Blank
                        cells here would read as three fields that failed to
                        render on a screen whose whole job is triage. */}
                    <Fact label="Carrier">
                      {claim.carrier ? (
                        <>
                          {claim.carrier}
                          <span className="block text-[12.5px] text-ink/55">
                            Policy {claim.policy_number ?? "—"} ·{" "}
                            {humanizeEnum(claim.carrier_tenure)}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink/58">{NOT_SUPPLIED}</span>
                      )}
                    </Fact>

                    <Fact label="Contact">
                      {primary?.email ?? "—"}
                      {primary?.phone ? (
                        <span className="block text-[12.5px] tabular-nums text-ink/55">
                          {primary.phone}
                        </span>
                      ) : null}
                    </Fact>
                    <Fact label="Prior roof claim">
                      {claim.prior_roof_claim
                        ? humanizeEnum(claim.prior_outcome)
                        : "None reported"}
                    </Fact>
                    <Fact label="Referred by">
                      {claim.referrer_name ? (
                        <>
                          {claim.referrer_name}
                          {claim.referrer_email ? (
                            <span className="block text-[12.5px] text-ink/55">
                              {claim.referrer_email}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-ink/55">Direct — no referral</span>
                      )}
                    </Fact>

                    {others.length > 0 ? (
                      <Fact label="Also on the claim" wide>
                        {others
                          .map((person) =>
                            `${person.first_name} ${person.last_name}`.trim(),
                          )
                          .join(", ")}
                      </Fact>
                    ) : null}

                    <Fact label="What happened" wide>
                      <span className="block max-w-[80ch] whitespace-pre-line text-[13.5px] leading-[1.65] text-ink/72">
                        {claim.description}
                      </span>
                    </Fact>

                    {claim.requested_adjuster ? (
                      <Fact label="Adjuster requested" wide>
                        {humanizeEnum(claim.requested_adjuster)}
                      </Fact>
                    ) : null}
                  </FactList>
                </div>

                <IntakeActions
                  claimId={claim.id}
                  claimRef={claim.claim_ref}
                  adjusters={adjusters}
                  partners={partners}
                  referrerName={claim.referrer_name}
                  needsPolicyDetails={claim.carrier === null}
                  canAccept={can.canManage}
                  canLinkPartner={can.isOwner}
                />
              </article>
            );
          })}
        </div>

        <ListPager
          label="Intake queue pages"
          noun="submission"
          pluralNoun="submissions"
          shown={claims.length}
          total={total}
          prevHref={prevCursor ? pageHref("prev", prevCursor) : null}
          nextHref={nextCursor ? pageHref("next", nextCursor) : null}
          startHref={cursor ? "/admin/intake" : null}
        />
        </>
      )}
    </>
  );
}
