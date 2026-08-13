import type { Metadata } from "next";
import Link from "next/link";
import { PortalShell } from "@/components/auth/portal-shell";
import { PartnerNav } from "@/components/partner/partner-nav";
import { ReferralForm } from "@/components/portal/referral-form";
import { partnerIdentity } from "@/lib/portal/partner-identity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Refer a claim",
  robots: { index: false, follow: false },
};

/**
 * The second and last page on the partner surface (spec §6).
 *
 * `partnerIdentity()` rather than a local profile read, for the reason that
 * helper records: the list, the 404 and now this page all name the reader, and
 * three copies of "who is signed in" is how one surface comes to call the same
 * person two different things.
 */
export default async function PartnerReferPage() {
  const identity = await partnerIdentity();

  return (
    <PortalShell
      surface="Partner portal"
      heading="Refer a claim."
      intro="Send us the homeowner and what happened. We take the policy details from them ourselves, so there is nothing here you have to chase before you submit."
      identity={identity}
    >
      <PartnerNav />
      <p className="mb-[clamp(24px,3vh,32px)] text-[15px] leading-[1.75] text-ink/72">
        <Link
          href="/partner"
          className="text-accent no-underline transition-colors duration-200 hover:text-accent-300"
        >
          Back to your referred claims
        </Link>
      </p>

      <ReferralForm />
    </PortalShell>
  );
}
