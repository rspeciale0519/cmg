import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { PortalShell } from "@/components/auth/portal-shell";
import { PartnerNav } from "@/components/partner/partner-nav";
import { ClaimTabs } from "@/components/portal/claim-tabs";
import { NOT_FOUND_TITLE } from "@/lib/authz";
import { humanizeEnum } from "@/lib/format";
import { loadPartnerClaim, requirePartnerClaim } from "@/lib/partner/queries";
import { partnerIdentity } from "@/lib/portal/partner-identity";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const summary = await loadPartnerClaim(id);
  return {
    title: summary?.claim_ref ?? NOT_FOUND_TITLE,
    robots: { index: false, follow: false },
  };
}

export default async function PartnerClaimLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: ReactNode;
}) {
  const { id } = await params;
  const [identity, summary] = await Promise.all([
    partnerIdentity(),
    requirePartnerClaim(id),
  ]);
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("claim_events")
    .select("id", { count: "exact", head: true })
    .eq("claim_id", id);
  if (error) throw new Error(`Partner activity count could not be loaded: ${error.message}`);

  const root = `/partner/claims/${id}`;
  const address = [summary.property_street, summary.property_city].filter(Boolean).join(", ");

  return (
    <PortalShell
      surface="Partner portal"
      heading={summary.homeowner_name ?? "Referred claim"}
      intro={<><span className="tabular-nums">{summary.claim_ref}</span> · {address || "Address pending"} · {humanizeEnum(summary.status)}</>}
      identity={identity}
    >
      <PartnerNav />
      <Link
        href="/partner"
        className="mb-4 inline-flex min-h-11 items-center text-sm text-accent no-underline hover:text-accent-300"
      >
        ← All referred claims
      </Link>
      <ClaimTabs
        root={root}
        tabs={[
          { href: root, label: "Summary" },
          { href: `${root}/activity`, label: "Activity", count: count ?? 0 },
        ]}
      />
      <div className="mt-[clamp(22px,3vh,32px)]">{children}</div>
    </PortalShell>
  );
}
