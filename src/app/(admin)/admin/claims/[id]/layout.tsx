import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackLink } from "@/components/admin/admin-shell";
import { ClaimTabs, type ClaimTab } from "@/components/admin/claim-tabs";
import { ClaimRef, StatusPill } from "@/components/admin/status-pill";
import { NOT_FOUND_TITLE } from "@/lib/authz";
import { claimTitleContext, loadClaimContext } from "@/lib/claims/queries";
import { customerPhaseFor } from "@/lib/claims/status";
import { formatAddressLine, formatDateOnly } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * `loadClaimContext` is right to `notFound()` — it is what renders the 404 —
 * but a `generateMetadata` that throws abandons metadata resolution entirely,
 * and the tab title came out as the empty string. That was one of three
 * different titles a single 404 could produce: `""` here, "Page not found ·
 * CMG claims desk" from an unrouted path, and the marketing "Page not found —
 * CMG Property Solutions". The page still calls `notFound()`; only the title
 * is decided without an exception, so every miss under `/admin` reads the same
 * in a tab strip. See `claimTitleContext` for how it answers without throwing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: (await claimTitleContext(id))?.claimRef ?? NOT_FOUND_TITLE,
    robots: { index: false, follow: false },
  };
}

export default async function ClaimLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { claim, can } = await loadClaimContext(id);
  const supabase = await createClient();

  const [claimants, documents, events] = await Promise.all([
    supabase
      .from("claimants")
      .select("id, first_name, last_name, is_primary", { count: "exact" })
      .eq("claim_id", id)
      .order("is_primary", { ascending: false }),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
    supabase
      .from("claim_events")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
  ]);

  const root = `/admin/claims/${id}`;
  const primary = claimants.data?.find((person) => person.is_primary) ??
    claimants.data?.[0];
  const phase = customerPhaseFor(claim.status);

  // Financials is absent, not disabled. `claim_financials` carries no policy at
  // all for an assistant (spec §4), so the tab would open a page that can only
  // ever render an empty money panel — and an empty panel reads as "no
  // settlement recorded", which is a different and false statement.
  const tabs: ClaimTab[] = [
    { href: root, label: "Overview" },
    { href: `${root}/claimants`, label: "Claimants", count: claimants.count ?? 0 },
    { href: `${root}/documents`, label: "Documents", count: documents.count ?? 0 },
    { href: `${root}/activity`, label: "Activity", count: events.count ?? 0 },
    ...(can.canSeeFinancials
      ? [{ href: `${root}/financials`, label: "Financials" }]
      : []),
    { href: `${root}/history`, label: "History" },
  ];

  return (
    <>
      <div className="pb-[clamp(16px,2vw,22px)]">
        <BackLink href="/admin/claims">All claims</BackLink>

        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* The claim reference is what this screen is about, so it is the
                  page's `h1` — the six tabs under it were opening at `h2` with no
                  top-level heading anywhere in the document. */}
              <ClaimRef
                as="h1"
                value={claim.claimRef}
                className="text-[clamp(20px,2.2vw,26px)] leading-[1.15] tracking-[-0.02em] text-ink"
              />
              <StatusPill status={claim.status} />
              {phase ? (
                <span className="text-[11.5px] leading-[1.4] text-ink/58">
                  homeowner sees &ldquo;{phase}&rdquo;
                </span>
              ) : null}
            </div>

            <p className="mt-[9px] text-[13.5px] leading-[1.55] text-ink/70">
              {primary
                ? `${primary.first_name} ${primary.last_name}`.trim()
                : "No claimant on file"}
              <span className="text-ink/55"> · </span>
              {formatAddressLine({
                street: claim.propertyStreet,
                street2: claim.propertyStreet2,
                city: claim.propertyCity,
                state: claim.propertyState,
                zip: claim.propertyZip,
              })}
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-[12.5px] leading-[1.4]">
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.13em] text-ink/58">
                Adjuster
              </dt>
              <dd className="mt-[4px] text-ink/78">
                {claim.adjusterName ?? (
                  <span className="text-accent/75">Unassigned</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.13em] text-ink/58">
                Referred by
              </dt>
              <dd className="mt-[4px] text-ink/78">
                {claim.partnerName ?? <span className="text-ink/55">Direct</span>}
              </dd>
            </div>
            <div>
              <dt className="text-[10.5px] uppercase tracking-[0.13em] text-ink/58">
                Date of loss
              </dt>
              <dd className="mt-[4px] tabular-nums text-ink/78">
                {formatDateOnly(claim.lossDate)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <ClaimTabs tabs={tabs} root={root} />

      <div className="pt-[clamp(20px,2.4vw,28px)]">{children}</div>
    </>
  );
}
