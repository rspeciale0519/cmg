import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClaimTabs } from "@/components/portal/claim-tabs";
import { ClaimSwitcher, PortalHeading } from "@/components/portal/frame";
import { listPortalClaims, requirePortalClaim } from "@/lib/portal/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The tab title, decided without throwing.
 *
 * Next resolves a segment's metadata independently of whether its component
 * renders, so a `generateMetadata` that called `requirePortalClaim()` would
 * `notFound()` during metadata resolution and the title would come out empty —
 * a second, distinguishable spelling of the refusal that `notFound()` exists to
 * make identical. `listPortalClaims()` is the same `cache()`d read the layout
 * already performs and it returns rows rather than throwing, so a claim that is
 * not this homeowner's simply is not in the list and gets the same title a
 * nonexistent id gets.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const claims = await listPortalClaims();
  const claim = claims.find((row) => row.id === id);

  return { title: claim ? claim.claim_ref : "Claim not found" };
}

export default async function ClaimLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;
  const { claim } = await requirePortalClaim(id);

  const supabase = await createClient();

  /* Both counts are `head: true` exact counts over the whole table rather than
     over the page, and both run under the caller's own client — so the number
     beside "Activity" counts entries marked `customer` or `shared`, the number
     beside "Documents" counts rows marked `customer`, and neither can report a
     row this homeowner cannot open. A count taken with any wider client would
     be a badge advertising the existence of internal notes. */
  const [claims, events, documents] = await Promise.all([
    listPortalClaims(),
    supabase
      .from("claim_events")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("claim_id", id),
  ]);

  const root = `/portal/claims/${id}`;

  return (
    <>
      <ClaimSwitcher claims={claims} currentId={id} />

      {/* The heading is the street and the line under it is the rest of the
          address — not the whole address again. `formatAddressLine()` opens with
          the street, so using it here printed "1420 Sandhill Crane Dr" as the
          h1 and "1420 Sandhill Crane Dr, Unit B, Winter Springs, Florida 32708"
          directly beneath it. A homeowner knows their own address; reading it
          twice tells them the page is padding. */}
      <PortalHeading
        kicker={`Claim ${claim.claim_ref}`}
        title={claim.property_street}
        intro={[
          claim.property_street2,
          `${claim.property_city}, ${claim.property_state} ${claim.property_zip}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <ClaimTabs
        root={root}
        tabs={[
          { href: root, label: "Overview" },
          { href: `${root}/activity`, label: "Activity", count: events.count ?? 0 },
          { href: `${root}/documents`, label: "Documents", count: documents.count ?? 0 },
        ]}
      />

      <div className="mt-[clamp(22px,3vh,32px)]">{children}</div>
    </>
  );
}
