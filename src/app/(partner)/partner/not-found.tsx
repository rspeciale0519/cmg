import Link from "next/link";
import { PortalShell } from "@/components/auth/portal-shell";
import { requireRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * The partner surface's own 404.
 *
 * `/admin` and `/portal` each got one and `/partner` did not, so `/partner/…`
 * anything fell through to the root `not-found.tsx` — the marketing 404, with
 * the public header, a "File a claim" button, "Call 24/7 · 407-488-5728", a
 * footer, and the sentence "If you were in the middle of a claim, nothing you
 * sent has been lost". A referring contractor was being addressed as a
 * homeowner, about a claim that is not theirs, with no route back to the one
 * page they can reach. That is the same failure `admin/not-found.tsx` records
 * being written to fix; this is the third and last surface to get its own.
 *
 * `requireRole` runs here for the reason the admin catch-all gives: this page
 * decides that a URL does not exist, and a signed-out visitor probing
 * `/partner/<guess>` must be sent to `/login` like everyone else rather than
 * shown which guesses miss.
 */
export default async function PartnerNotFound() {
  const session = await requireRole("partner");

  return (
    <PortalShell
      surface="Partner portal"
      heading="That page isn’t here."
      intro="The address does not name anything in your portal. Your referred claims are all reachable from one page."
      identity={{ name: session.email ?? "Partner", role: "Partner" }}
    >
      <p className="text-[15px] leading-[1.75] text-ink/72">
        <Link
          href="/partner"
          className="text-accent no-underline transition-colors duration-200 hover:text-accent-300"
        >
          Back to your referred claims
        </Link>
      </p>
    </PortalShell>
  );
}
