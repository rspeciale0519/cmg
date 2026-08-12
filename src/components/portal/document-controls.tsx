"use client";

import { useActionState, useEffect, useRef } from "react";
import { FileField, SelectField } from "@/components/forms/controls";
import {
  issuePortalDownload,
  uploadPortalDocument,
} from "@/lib/actions/portal-documents";
import { idleDownloadState, idleState } from "@/lib/actions/types";
import { PORTAL_DOCUMENT_KINDS } from "@/lib/portal/documents";
import { FILE_ACCEPT_ATTRIBUTE, FILE_RULES_HINT } from "@/lib/validators/files";
import { FormFeedback, SubmitButton } from "./form-controls";

/**
 * Send CMG a file.
 *
 * The kind picker comes before the file picker because it is the question the
 * homeowner can answer without thinking, and because the answer decides how the
 * adjuster finds it later. `PORTAL_DOCUMENT_KINDS` is imported from the action
 * rather than restated here, so the list the form offers and the list the server
 * accepts are one list — and `documents_insert` holds the same four values
 * underneath both.
 */
export function DocumentUpload({ claimId }: { claimId: string }) {
  const [state, formAction] = useActionState(uploadPortalDocument, idleState);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="claimId" value={claimId} />

      <div className="grid gap-[18px]">
        <SelectField
          name="kind"
          label="What is this?"
          required
          error={state.fieldErrors?.kind}
          defaultValue={state.values?.kind ?? "photo"}
          options={PORTAL_DOCUMENT_KINDS.map((kind) => ({
            value: kind.value,
            label: kind.label,
          }))}
        />

        {/* No `defaultValue`, and it is not an oversight: no page may set a file
            input's value, so a refusal loses the chosen file and the person has
            to pick it again. The dropdown above is handed back precisely because
            it is the part that *can* be, and re-answering one question is better
            than re-answering two. */}
        <FileField
          name="files"
          label="Choose files"
          multiple
          accept={FILE_ACCEPT_ATTRIBUTE}
          error={state.fieldErrors?.files}
          hint={FILE_RULES_HINT}
        />
      </div>

      <div className="mt-[18px]">
        <SubmitButton pendingLabel="Sending…">Send to CMG</SubmitButton>
      </div>

      <FormFeedback state={state} />
    </form>
  );
}

/**
 * Two steps, deliberately: ask the server for a link, then follow it.
 *
 * A plain `<a href>` to the object is impossible — the `claim-docs` bucket has
 * no policy for `authenticated` at all, so there is no URL to put in the anchor
 * until a server action has checked this homeowner against `documents_select`
 * and minted a signed one. That check is also what produces the `audit_log` row
 * §7.5 requires, so a download that skipped it would be a download nobody can
 * account for afterwards.
 *
 * The URL is opened by clicking a real anchor rather than by assigning
 * `location`, so the browser treats it as a user-initiated navigation and the
 * `Content-Disposition: attachment` on it starts a download instead of replacing
 * the portal. It is never rendered as text: it is a bearer credential for five
 * minutes, and a URL on screen is a URL that gets photographed.
 */
export function DocumentDownload({
  documentId,
  label,
}: {
  documentId: string;
  label: string;
}) {
  const [state, formAction] = useActionState(issuePortalDownload, idleDownloadState);
  const anchor = useRef<HTMLAnchorElement>(null);
  const claimed = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== "success" || !state.url) return;
    // Guarded so a re-render — or React's development double-invoke — cannot
    // fire one click twice and write two audit rows for one download.
    if (claimed.current === state.url) return;
    claimed.current = state.url;
    anchor.current?.click();
  }, [state.status, state.url]);

  return (
    <div className="flex flex-col items-start gap-[6px] sm:items-end">
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
          <p role="status" className="text-[12px] leading-[1.45] text-ink/42">
            Downloading · link expires in 5 minutes
          </p>
        </>
      ) : null}

      {state.status === "error" ? (
        <p
          role="alert"
          className="max-w-[34ch] text-[12px] leading-[1.5] text-[#E08C6A] sm:text-right"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
