"use client";

import { useActionState, useEffect, useRef } from "react";
import { FileField, SelectField } from "@/components/forms/controls";
import {
  finalizePortalDocumentUpload,
  issuePortalDownload,
  preparePortalDocumentUpload,
} from "@/lib/actions/portal-documents";
import { idleDownloadState, resilient } from "@/lib/actions/types";
import { PORTAL_DOCUMENT_KINDS } from "@/lib/portal/documents";
import { FILE_ACCEPT_ATTRIBUTE, FILE_RULES_HINT } from "@/lib/validators/files";
import { FormFeedback, SubmitButton } from "./form-controls";
import { usePrivateDocumentUpload } from "@/components/forms/use-private-document-upload";

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
  const upload = usePrivateDocumentUpload(
    preparePortalDocumentUpload,
    finalizePortalDocumentUpload,
    "Send to CMG",
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        upload.submit(event.currentTarget);
      }}
    >
      <input type="hidden" name="claimId" value={claimId} />

      <fieldset disabled={upload.locked || upload.pending} className="grid gap-[18px] border-0 p-0">
        <SelectField
          name="kind"
          label="What is this?"
          required
          error={upload.state.fieldErrors?.kind}
          defaultValue="photo"
          options={PORTAL_DOCUMENT_KINDS.map((kind) => ({
            value: kind.value,
            label: kind.label,
          }))}
        />

        <FileField
          name="files"
          label="Choose files"
          multiple
          accept={FILE_ACCEPT_ATTRIBUTE}
          error={upload.state.fieldErrors?.files}
          hint={FILE_RULES_HINT}
          disabled={upload.locked || upload.pending}
          onChange={(event) => upload.selectFiles(event.currentTarget.files)}
        />
      </fieldset>

      <div className="mt-[18px]">
        <fieldset
          disabled={upload.pending || (upload.locked && !upload.state.message)}
          className="border-0 p-0"
        >
          <SubmitButton pendingLabel={upload.buttonLabel}>{upload.buttonLabel}</SubmitButton>
        </fieldset>
      </div>

      {upload.progressMessage ? (
        <p role="status" aria-live="polite" className="mt-2 text-[13px] text-ink/55">
          {upload.progressMessage}
        </p>
      ) : null}
      <FormFeedback state={upload.state} />
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
  const [state, formAction] = useActionState(resilient(issuePortalDownload), idleDownloadState);
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
          <p role="status" className="text-[12px] leading-[1.45] text-ink/55">
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
