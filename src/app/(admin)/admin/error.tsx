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
 * "Try again" first, because `reset()` genuinely does re-render the segment and
 * a transient database hiccup really is fixed by it. The way out of the page is
 * offered next to it rather than instead of it.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error", {
      digest: error.digest,
      message: error.message,
    });
  }, [error]);

  return (
    <>
      <PageHeader
        eyebrow="Error"
        title="This page didn’t load."
        lede="Something failed while building the screen. Nothing you were looking at has been changed, and no work has been lost."
      />

      <Panel title="What to do">
        <PanelBody>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton variant="primary" onClick={() => reset()}>
              Try again
            </AdminButton>
            <Link
              href="/admin"
              className="min-h-[34px] rounded-md border border-ink/16 px-[13px] py-[7px] text-[13px] font-medium leading-[1.4] text-ink/80 no-underline transition-colors duration-150 hover:border-ink/32 hover:text-ink"
            >
              Back to the dashboard
            </Link>
          </div>

          <p className="mt-[16px] max-w-[70ch] text-[12.5px] leading-[1.65] text-ink/58">
            If it fails again, send this reference to whoever looks after the
            site — it identifies this exact failure in the server log.
          </p>

          <p className="mt-[8px] font-mono text-[12px] leading-[1.5] text-ink/62">
            {error.digest ?? "No reference was recorded for this failure."}
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}
