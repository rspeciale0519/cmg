"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PageHeader, Panel, PanelBody } from "@/components/admin/admin-shell";
import { AdminButton } from "@/components/admin/form-controls";

/**
 * The workspace's error boundary. Like `not-found.tsx` it renders inside
 * `AdminShell`, so a failed page still leaves the staff member standing in the
 * workspace with the nav under their hand rather than on the marketing site.
 *
 * Errors do not apologise and are never vague about what happened, but they
 * also must not leak: `error.message` from a server render is redacted by
 * Next.js in production and can carry a query, a column name or an id in
 * development. The `digest` is the honest thing to show — it is the one token
 * that ties this screen to the server log entry, which is what somebody
 * chasing it actually needs.
 *
 * "Try again" first: Next's `retry()` refreshes server data before resetting
 * the boundary, so recovery does not render the same cached failure. The way out is
 * offered next to it rather than instead of it.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <>
      {/* The lede used to end "Nothing you were looking at has been changed, and
          no work has been lost." Both halves were promises this screen is not in
          a position to keep. It is reached from a failed *submission* as often
          as from a failed render — `useActionState` re-throws a rejected action
          during render — and in that case the note the adjuster had just written
          was gone, and whether the write committed is exactly what nobody knows:
          a dropped connection looks the same whether the request never left or
          its response was lost coming back. `resilient()` now keeps most of
          those failures out of this boundary entirely; the wording here stops
          asserting what it cannot check for the rest. */}
      <PageHeader
        eyebrow="Error"
        title="This page didn’t load."
        lede="Something failed while the screen was being put together. If you had just saved something, check whether it went through before you try it again."
      />

      <Panel title="What to do">
        <PanelBody>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton variant="primary" onClick={() => retry()}>
              Try again
            </AdminButton>
            <Link
              href="/admin"
              className="min-h-[34px] rounded-md border border-ink/16 px-[13px] py-[7px] text-[13px] font-medium leading-[1.4] text-ink/80 no-underline transition-colors duration-150 hover:border-ink/32 hover:text-ink"
            >
              Back to the dashboard
            </Link>
          </div>

          {/* Rendered only when there is a reference. A client-side rejection
              carries no `digest`, so this paragraph used to end by telling the
              reader to send a reference that its own next line said did not
              exist — an instruction that cannot be followed, on the screen
              where the reader is already stuck. */}
          {error.digest ? (
            <>
              <p className="mt-[16px] max-w-[70ch] text-[12.5px] leading-[1.65] text-ink/58">
                If it fails again, send this reference to whoever looks after the
                site — it identifies this exact failure in the server log.
              </p>

              <p className="mt-[8px] font-mono text-[12px] leading-[1.5] text-ink/62">
                {error.digest}
              </p>
            </>
          ) : (
            <p className="mt-[16px] max-w-[70ch] text-[12.5px] leading-[1.65] text-ink/58">
              If it keeps happening, check your connection first — then tell
              whoever looks after the site what you were doing when it failed.
            </p>
          )}
        </PanelBody>
      </Panel>
    </>
  );
}
