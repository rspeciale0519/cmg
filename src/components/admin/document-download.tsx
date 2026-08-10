"use client";

import { useActionState, useEffect, useRef } from "react";
import { issueDocumentDownload } from "@/lib/actions/documents";
import { idleDownloadState } from "@/lib/actions/types";
import { SubmitButton } from "./form-controls";

/**
 * Two steps, deliberately: ask the server for a link, then follow it.
 *
 * A plain `<a href>` to the object is impossible — the bucket has no policy for
 * `authenticated` at all, so there is no URL to put in the anchor until a
 * server action has checked the caller against `documents_select` and minted a
 * signed one. That check is also what produces the `audit_log` row §7.5
 * requires, so a download that skipped it would be a download nobody can
 * account for afterwards.
 *
 * The returned URL is opened by clicking a real anchor rather than by assigning
 * `location`, so the browser treats it as a user-initiated navigation and its
 * `Content-Disposition: attachment` starts a download instead of replacing the
 * workspace. The link is never rendered as text: it is a bearer credential for
 * five minutes, and a URL sitting on screen is a URL that gets screenshotted
 * into a ticket.
 */
export function DocumentDownload({
  documentId,
  label,
}: {
  documentId: string;
  label: string;
}) {
  const [state, formAction] = useActionState(
    issueDocumentDownload,
    idleDownloadState,
  );
  const anchor = useRef<HTMLAnchorElement>(null);
  const claimed = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== "success" || !state.url) return;
    // Guarded so a re-render (or React's development double-invoke) cannot fire
    // the same download twice and write two audit rows for one click.
    if (claimed.current === state.url) return;
    claimed.current = state.url;
    anchor.current?.click();
  }, [state.status, state.url]);

  return (
    <div className="flex flex-col items-end gap-[5px]">
      <form action={formAction}>
        <input type="hidden" name="documentId" value={documentId} />
        <SubmitButton variant="secondary" pendingLabel="Preparing…">
          Download
        </SubmitButton>
      </form>

      {state.status === "success" && state.url ? (
        <>
          <a
            ref={anchor}
            href={state.url}
            download={state.filename}
            rel="noreferrer"
            className="sr-only"
          >
            {label}
          </a>
          <p role="status" className="text-[11.5px] leading-[1.4] text-ink/42">
            Link issued · expires in 5 minutes
          </p>
        </>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="max-w-[36ch] text-right text-[11.5px] leading-[1.45] text-[#E8A98D]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
