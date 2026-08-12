import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalHeading } from "@/components/portal/frame";
import { EmptyState, Panel } from "@/components/portal/surfaces";
import { customerPhaseFor } from "@/lib/claims/status";
import { formatAddressLine, formatDateOnly } from "@/lib/format";
import { listPortalClaims } from "@/lib/portal/queries";
import { site, telHref } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your claims",
};

/**
 * The front door, and it is a router rather than a screen most of the time.
 *
 * One claim is the ordinary case, and making that person choose from a list of
 * one before they can see their own roof is furniture standing between them and
 * the thing they came for — so it redirects. Two or more is the case spec §10
 * puts in v1 rather than behind a flag, because a homeowner who has been through
 * two Florida storms is not an edge case, and then the list is the right screen.
 * Zero is a real state too: an account exists the moment an invitation is
 * accepted, and a claim can be detached afterwards.
 */
export default async function PortalIndexPage() {
  const claims = await listPortalClaims();

  if (claims.length === 1) redirect(`/portal/claims/${claims[0].id}`);

  if (claims.length === 0) {
    return (
      <>
        <PortalHeading
          kicker="Your account"
          title="Nothing is on your account yet."
          intro="If you have just filed a claim with us, it appears here as soon as we accept it and link it to you."
        />
        <Panel>
          <EmptyState headline="No claims are attached to this account.">
            If you were expecting to see one, call us on{" "}
            <a href={telHref} className="text-accent no-underline hover:text-accent-300">
              {site.phone}
            </a>{" "}
            and we will put it right.
          </EmptyState>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PortalHeading
        kicker="Your account"
        title="Your claims."
        intro="Pick a claim to see where it stands, read the activity on it, and send us documents."
      />

      <ul className="grid gap-4 md:grid-cols-2">
        {claims.map((claim) => {
          const phase = customerPhaseFor(claim.status);

          return (
            <li key={claim.id} className="min-w-0">
              {/* The whole card is the link. A card with a "View claim" button
                  in the corner gives a 44px target inside a 200px one for no
                  reason — there is nothing else on it to click. */}
              <Link
                href={`/portal/claims/${claim.id}`}
                className="flex h-full flex-col border border-ink/13 bg-surface/38 p-[clamp(20px,2.4vw,26px)] text-inherit no-underline transition-colors duration-200 hover:border-ink/28 hover:bg-surface/55"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                  <span className="text-[17px] font-medium leading-[1.3] tracking-[-0.015em] tabular-nums">
                    {claim.claim_ref}
                  </span>
                  {phase ? (
                    <span className="text-[11px] uppercase leading-[1.5] tracking-[0.16em] text-accent">
                      {phase}
                    </span>
                  ) : null}
                </div>

                <p className="mt-[12px] text-[14.5px] leading-[1.65] text-ink/78">
                  {formatAddressLine({
                    street: claim.property_street,
                    street2: claim.property_street2,
                    city: claim.property_city,
                    state: claim.property_state,
                    zip: claim.property_zip,
                  })}
                </p>

                <p className="mt-auto pt-[14px] text-[13px] leading-[1.6] text-ink/55">
                  {claim.carrier ? `${claim.carrier} · ` : ""}loss on{" "}
                  {formatDateOnly(claim.loss_date)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
