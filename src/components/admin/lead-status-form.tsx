"use client";

import { useActionState, useState } from "react";
import { updateLeadStatus } from "@/lib/actions/leads";
import { idleState, resilient } from "@/lib/actions/types";
import { AdminSelect, SubmitButton } from "./form-controls";

const NEXT_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  dismissed: "Dismissed",
};

/**
 * One row, one form. A single bulk form with a select per row would submit
 * every row's value on every save and make an accidental change to a lead the
 * operator never looked at.
 *
 * The select does not auto-submit. A lead's status is a claim about what a
 * person did — "I called them" — and a control that fires on change turns a
 * mis-scroll over a dropdown into a false record.
 *
 * Save appears only once the value differs from the stored one, which is the
 * rule `StaffRoleForm` already states and this form did not follow. A live Save
 * beside an untouched select ran a real UPDATE and wrote `leads.status_changed`
 * with `from` equal to `to`, then reported the lead "marked contacted" — an
 * audit entry and a success sentence for a change that did not happen. The
 * server refuses the same case now; this is the half that stops it being
 * offered.
 */
export function LeadStatusForm({
  leadId,
  status,
  canEdit,
}: {
  leadId: string;
  status: string;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(resilient(updateLeadStatus), idleState);
  const [dirty, setDirty] = useState(false);

  if (!canEdit) return null;

  return (
    <form
      action={formAction}
      onReset={() => setDirty(false)}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <label htmlFor={`admin-status-${leadId}`} className="sr-only">
        Status
      </label>
      <AdminSelect
        name="status"
        id={`admin-status-${leadId}`}
        key={status}
        defaultValue={status}
        onChange={(event) => setDirty(event.target.value !== status)}
        className="min-w-[126px]"
      >
        {Object.entries(NEXT_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </AdminSelect>
      {dirty ? (
        <SubmitButton variant="secondary" pendingLabel="Saving…">
          Save
        </SubmitButton>
      ) : null}
      {state.status === "error" && state.message ? (
        <span role="alert" className="text-[12px] leading-[1.4] text-[#E8A98D]">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
