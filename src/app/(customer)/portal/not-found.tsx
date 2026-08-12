import Link from "next/link";
import { Panel, PanelBody } from "@/components/portal/surfaces";
import { PortalHeading } from "@/components/portal/frame";
import { site, telHref } from "@/lib/site";

/**
 * One page for every miss under `/portal`, and that is the whole point.
 *
 * A claim that does not exist, a claim belonging to another homeowner, and a
 * mistyped URL all arrive here saying the same thing, because §7.9 requires that
 * a portal account cannot tell them apart — a 403 on one uuid and a 404 on
 * another together enumerate the claims table for anyone with an account.
 *
 * So the copy names no resource and admits no possibility that the thing exists.
 * It offers the two ways out that always work: back to their own claims, or the
 * phone.
 */
export default function PortalNotFound() {
  return (
    <>
      <PortalHeading
        kicker="Not found"
        title="We could not find that page."
        intro="The link may be old, or it may point at something that is not on your account."
      />

      <Panel>
        <PanelBody>
          <p className="max-w-[56ch] text-[15px] leading-[1.75] text-ink/72">
            Everything on your account is reachable from your claims. If you were
            expecting to find something here, call us on{" "}
            <a href={telHref} className="text-accent no-underline hover:text-accent-300">
              {site.phone}
            </a>{" "}
            and we will look it up with you.
          </p>

          <Link
            href="/portal"
            className="mt-[22px] inline-flex min-h-[46px] items-center rounded-md border border-accent px-[22px] text-sm leading-[1.2] font-medium text-accent no-underline transition-colors duration-200 hover:bg-accent/12 active:bg-accent/22"
          >
            Back to your claims
          </Link>
        </PanelBody>
      </Panel>
    </>
  );
}
