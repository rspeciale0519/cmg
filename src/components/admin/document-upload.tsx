"use client";

import { useActionState } from "react";
import { uploadClaimDocument } from "@/lib/actions/documents";
import { idleState } from "@/lib/actions/types";
import {
  DOCUMENT_KIND_LABEL,
  DOCUMENT_KINDS,
  isRepresentationKind,
} from "@/lib/claims/documents";
import { FILE_ACCEPT_ATTRIBUTE, FILE_RULES_HINT } from "@/lib/validators/files";
import { ActionFeedback, AdminField, AdminSelect, SubmitButton } from "./form-controls";

/**
 * `kind` and `visibility` are asked for at upload time rather than defaulted
 * and corrected later, because both are load-bearing. `kind` is what
 * `enforce_claim_status_transition()` consults at the LOR gate, and
 * `visibility` decides whether a homeowner sees the file the moment it lands —
 * a document silently defaulted to customer-visible is a disclosure nobody
 * chose to make.
 *
 * The two representation kinds are offered only to the owner and the assigned
 * adjuster, matching `documents_insert`. Offering them to an assistant would
 * upload the bytes, have the row refused, and roll the object back — a slow
 * failure where an absent option is an instant answer.
 */
export function DocumentUpload({
  claimId,
  canUploadRepresentation,
}: {
  claimId: string;
  canUploadRepresentation: boolean;
}) {
  const [state, formAction] = useActionState(uploadClaimDocument, idleState);

  const kinds = DOCUMENT_KINDS.filter(
    (kind) => canUploadRepresentation || !isRepresentationKind(kind),
  );

  return (
    /* `noValidate` for the reason the rest of this workspace carries it: the
       file input is `required`, and Chrome answered an empty submit with its
       own popup instead of running the action. The two dropdowns come back
       holding what was chosen, because the reset that follows a refusal would
       otherwise quietly return `visibility` to "CMG only" — re-asking a
       disclosure decision the operator had already made. The file itself
       cannot be handed back; no page may set a file input's value. */
    <form action={formAction} noValidate>
      <input type="hidden" name="claimId" value={claimId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField name="kind" label="What is it">
          <AdminSelect name="kind" defaultValue={state.values?.kind ?? "other"}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {DOCUMENT_KIND_LABEL[kind]}
              </option>
            ))}
          </AdminSelect>
        </AdminField>

        <AdminField name="visibility" label="Who can see it">
          <AdminSelect
            name="visibility"
            defaultValue={state.values?.visibility ?? "internal"}
          >
            <option value="internal">CMG only</option>
            <option value="customer">Homeowner can see it</option>
          </AdminSelect>
        </AdminField>
      </div>

      {/* The refusal marks the field, which it did not before. A rejected upload
          answered with one sentence at the foot of the form, 105px below a file
          input carrying no `aria-invalid`, no `aria-describedby` and its resting
          border — and React's reset had just emptied that input, so the single
          control that had to be redone was the one nothing pointed at. This is
          the shape `event-composer.tsx` records fixing for its textarea.

          The `aria-invalid:` variants are spelled out rather than appended,
          because `border-ink/15` and a bare ember border are equal-specificity
          single-class selectors and emit order would otherwise decide which one
          paints. */}
      <AdminField
        name="files"
        label="File"
        hint={FILE_RULES_HINT}
        error={state.fieldErrors?.files}
        className="mt-4"
      >
        <input
          id="admin-files"
          type="file"
          name="files"
          multiple
          required
          accept={FILE_ACCEPT_ATTRIBUTE}
          aria-invalid={state.fieldErrors?.files ? true : undefined}
          aria-describedby={state.fieldErrors?.files ? "admin-files-error" : undefined}
          className="w-full rounded-md border border-ink/15 bg-canvas/70 p-[9px] text-[13px] leading-[1.5] text-ink/78 transition-colors duration-150 hover:border-ink/40 focus-visible:border-accent focus-visible:outline-offset-0 file:mr-3 file:rounded file:border file:border-ink/20 file:bg-transparent file:px-[9px] file:py-[3px] file:text-[12.5px] file:text-ink/78 aria-invalid:border-[#E08C6A] aria-invalid:hover:border-[#E08C6A] aria-invalid:focus-visible:border-[#E08C6A] aria-invalid:focus-visible:outline-[#E08C6A]"
        />
      </AdminField>

      <div className="mt-[14px]">
        <SubmitButton pendingLabel="Uploading…">Add to the file</SubmitButton>
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
