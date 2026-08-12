"use client";

import { useEffect } from "react";
import { site, telHref } from "@/lib/site";

/**
 * The portal's own failure screen.
 *
 * `digest` is rendered and the message is not. Next replaces a server error's
 * message with an opaque digest in production precisely so that a stack trace or
 * a Postgres error string cannot reach the browser, and printing `error.message`
 * here would hand back exactly what that mechanism removes the moment a
 * development build is deployed. The digest is the token that lets support match
 * this screen to the server log, which is the only thing on it a homeowner can
 * usefully read out over the phone.
 *
 * No `PortalHeading` and no `Panel`: an error boundary renders in place of the
 * subtree that threw, and importing the surface components would mean the
 * failure screen depends on the same modules whose failure it exists to catch.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal] render failed", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[62ch] py-[clamp(28px,6vh,64px)]">
      <span aria-hidden="true" className="mb-[18px] block h-px w-10 bg-accent" />
      <h1 className="text-[clamp(24px,3vw,32px)] font-medium leading-[1.2] tracking-[-0.025em]">
        Something went wrong at our end.
      </h1>
      {/* "nothing has changed" was a promise this screen cannot keep — it is
          reached from a failed submission as well as a failed render, and a
          dropped connection looks the same whether the request never left or
          its answer was lost on the way back. Your claim being safe is true and
          worth saying to a homeowner; the rest asks them to check rather than
          telling them something nobody knows. */}
      <p className="mt-[14px] text-[15px] leading-[1.75] text-ink/72">
        Your claim is safe. If you had just sent something, check whether it
        arrived before you send it again — then try again, and if it happens
        twice call us on{" "}
        <a href={telHref} className="text-accent no-underline hover:text-accent-300">
          {site.phone}
        </a>
        .
      </p>

      <div className="mt-[24px] flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[46px] items-center rounded-md border border-accent px-[22px] text-sm leading-[1.2] font-medium text-accent transition-colors duration-200 hover:bg-accent/12 active:bg-accent/22"
        >
          Try again
        </button>
        <a
          href="/portal"
          className="inline-flex min-h-[46px] items-center rounded-md border border-ink/16 px-[22px] text-sm leading-[1.2] text-ink no-underline transition-colors duration-200 hover:bg-ink/7"
        >
          Back to your claims
        </a>
      </div>

      {error.digest ? (
        <p className="mt-[24px] text-[12.5px] leading-[1.6] text-ink/58">
          If you call us, quote this: <span className="tabular-nums">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
