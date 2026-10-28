"use client";

import Link from "next/link";
import { useEffect } from "react";
import { site, telHref } from "@/lib/site";

/**
 * The partner surface's own failure screen, and the third of three. `/admin` and
 * `/portal` each had one; `/partner` had neither this nor a 404, so any throw
 * here reached Next's built-in global error page.
 *
 * `digest` is rendered and the message is not — same reason as the portal's:
 * Next replaces a server error's message with an opaque digest in production so
 * a stack trace or a Postgres string cannot reach the browser, and printing
 * `error.message` would hand back exactly what that removes the moment a
 * development build ships. The digest is the token support can match to the log.
 *
 * No `PortalShell` import: an error boundary renders in place of the subtree
 * that threw, and a failure screen must not depend on the modules whose failure
 * it exists to catch.
 *
 * The copy does not promise that nothing changed. This boundary is reached from
 * a failed submission as readily as from a failed render, and a dropped
 * connection looks identical whether the request never left or its answer was
 * lost coming back.
 */
export default function PartnerError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[partner] render failed", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[62ch] py-[clamp(28px,6vh,64px)]">
      <span aria-hidden="true" className="mb-[18px] block h-px w-10 bg-accent" />
      <h1 className="text-[clamp(24px,3vw,32px)] font-medium leading-[1.2] tracking-[-0.025em]">
        Something went wrong at our end.
      </h1>
      <p className="mt-[14px] text-[15px] leading-[1.75] text-ink/72">
        The claims you referred are safe. Try again, and if it happens twice call
        us on{" "}
        <a href={telHref} className="text-accent no-underline hover:text-accent-300">
          {site.phone}
        </a>
        .
      </p>

      <div className="mt-[24px] flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-[46px] items-center rounded-md border border-accent px-[22px] text-sm leading-[1.2] font-medium text-accent transition-colors duration-200 hover:bg-accent/12 active:bg-accent/22"
        >
          Try again
        </button>
        <Link
          href="/partner"
          className="inline-flex min-h-[46px] items-center rounded-md border border-ink/16 px-[22px] text-sm leading-[1.2] text-ink no-underline transition-colors duration-200 hover:bg-ink/7"
        >
          Back to your referred claims
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-[24px] text-[12.5px] leading-[1.6] text-ink/58">
          If you call us, quote this: <span className="tabular-nums">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
