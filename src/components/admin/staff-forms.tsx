"use client";

import { useActionState, useState } from "react";
import { changeStaffRole, inviteStaff, setStaffActive } from "@/lib/actions/staff";
import { idleInviteIssueState, idleState } from "@/lib/actions/types";
import type { AppRole } from "@/lib/auth/roles";
import {
  ActionFeedback,
  AdminField,
  AdminInput,
  AdminSelect,
  SubmitButton,
} from "./form-controls";
import { ROLE_LABEL } from "./nav";

const STAFF_ROLE_OPTIONS: readonly AppRole[] = ["owner", "adjuster", "assistant"];

/**
 * The role control does not auto-submit. Changing someone's role is the single
 * most consequential thing on this screen — `owner` can change every other
 * account — and a select that fires on change turns a mis-scroll into a
 * privilege grant. Save appears only once the value differs from the stored one,
 * so the row is quiet until there is actually something to save.
 *
 * The select is UNCONTROLLED, and that is the fix for a bug this screen had and
 * a trap any form driven by a Server Action shares.
 *
 * React 19 resets a `<form action={…}>` once the action resolves. For an
 * uncontrolled field that is exactly right — the form has been submitted and
 * should go back to reflecting the server. For a field controlled by client
 * state seeded from a server prop it is a silent lie: the DOM snaps back to the
 * option that was selected at mount, React's state still holds the value the
 * user picked, so nothing re-renders and nothing re-asserts the value. The
 * control ends up showing the OLD role directly beside a message saying the new
 * one was saved, and it stays wrong until a manual reload. Observed on this very
 * table before this comment existed.
 *
 * So the server prop is the only source of truth for the value. `defaultValue`
 * seeds it, `onReset` clears the dirty flag when React resets the form, and
 * `key={role}` on the select alone — not on this component — re-seeds the
 * control when the role changes server-side. Keying the whole component would
 * work too, and would throw away `useActionState`'s result with it: the row
 * would silently show the new role and never say it saved. On a refusal the role
 * is unchanged, the key holds, the field returns to the truth, and the message
 * explains why.
 */
export function StaffRoleForm({
  staffId,
  role,
  disabled,
  disabledReason,
}: {
  staffId: string;
  role: AppRole;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState(changeStaffRole, idleState);
  const [dirty, setDirty] = useState(false);

  return (
    <form
      action={formAction}
      onReset={() => setDirty(false)}
      className="min-w-0"
    >
      <input type="hidden" name="staffId" value={staffId} />
      <div className="flex items-center gap-2">
        <label htmlFor={`admin-role-${staffId}`} className="sr-only">
          Role
        </label>
        <AdminSelect
          key={role}
          name="role"
          id={`admin-role-${staffId}`}
          defaultValue={role}
          disabled={disabled}
          onChange={(event) => setDirty(event.target.value !== role)}
          className="min-w-[122px]"
        >
          {STAFF_ROLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABEL[option]}
            </option>
          ))}
        </AdminSelect>
        {dirty && !disabled ? (
          <SubmitButton variant="secondary" pendingLabel="Saving…">
            Save
          </SubmitButton>
        ) : null}
      </div>

      {/* `ink/60` (5.46:1), not `ink/38` (3.02:1). This sentence is the only
          thing on screen that says why the select above it is dim and inert,
          and it was quieter than the control it explains — the rule
          `financials-form.tsx` already states and applies. */}
      {disabled && disabledReason ? (
        <p className="mt-[6px] max-w-[34ch] text-[11.5px] leading-[1.5] text-ink/65">
          {disabledReason}
        </p>
      ) : null}

      <ActionFeedback state={state} />
    </form>
  );
}

/**
 * Deactivation is reversible by another owner and is the offboarding control, so
 * it is a plain secondary button rather than a danger one. The exception is an
 * owner deactivating themselves: the consequence is that they cannot undo it,
 * which the caller is told before they click rather than after.
 */
export function StaffActiveForm({
  staffId,
  name,
  isActive,
  isSelf,
  disabled,
  disabledReason,
}: {
  staffId: string;
  name: string;
  isActive: boolean;
  isSelf: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState(setStaffActive, idleState);

  return (
    <form action={formAction} className="min-w-0">
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <SubmitButton
        variant={isActive ? "secondary" : "primary"}
        disabled={disabled}
        pendingLabel={isActive ? "Deactivating…" : "Restoring…"}
      >
        {isActive ? "Deactivate" : "Restore access"}
      </SubmitButton>

      <span className="sr-only">
        {isActive ? `Deactivate ${name}` : `Restore access for ${name}`}
      </span>

      {disabled && disabledReason ? (
        <p className="mt-[6px] max-w-[34ch] text-[11.5px] leading-[1.5] text-ink/65">
          {disabledReason}
        </p>
      ) : isActive && isSelf ? (
        <p className="mt-[6px] max-w-[34ch] text-[11.5px] leading-[1.5] text-ink/65">
          You cannot restore your own account afterwards.
        </p>
      ) : null}

      <ActionFeedback state={state} />
    </form>
  );
}

export function StaffInviteForm() {
  const [state, formAction] = useActionState(inviteStaff, idleInviteIssueState);

  return (
    <form action={formAction} noValidate className="max-w-[720px]">
      <div className="grid gap-x-6 gap-y-[15px] sm:grid-cols-3">
        <AdminField name="email" label="Work email" error={state.fieldErrors?.email}>
          <AdminInput
            name="email"
            type="email"
            defaultValue={state.values?.email ?? ""}
            required
            maxLength={254}
            autoComplete="off"
            placeholder="name@cmgpropertysolutions.net"
            error={state.fieldErrors?.email}
          />
        </AdminField>

        <AdminField
          name="firstName"
          label="First name"
          hint="optional"
          error={state.fieldErrors?.firstName}
        >
          <AdminInput
            name="firstName"
            defaultValue={state.values?.firstName ?? ""}
            maxLength={80}
            autoComplete="off"
            error={state.fieldErrors?.firstName}
          />
        </AdminField>

        <AdminField name="role" label="Joins as" error={state.fieldErrors?.role}>
          {/* The role a refusal comes back holding is the role that was
              submitted, not "adjuster" — see AdminSelect for why an echoed
              default needs the element re-keyed to take effect. */}
          <AdminSelect
            name="role"
            defaultValue={state.values?.role ?? "adjuster"}
            error={state.fieldErrors?.role}
          >
            <option value="adjuster">Adjuster</option>
            <option value="assistant">Assistant</option>
          </AdminSelect>
        </AdminField>
      </div>

      <div className="mt-[15px]">
        <SubmitButton pendingLabel="Sending…">Send invitation</SubmitButton>
      </div>

      <p className="mt-[10px] max-w-[68ch] text-[12.5px] leading-[1.6] text-ink/55">
        The link works once and expires after 72 hours. Owner is not offered here
        because the database refuses an owner invitation — a 72-hour link in an
        inbox should not be able to mint the account that controls every other
        account. Invite the person as an adjuster or assistant, then change their
        role in the table above once they have signed in.
      </p>

      <ActionFeedback state={state} />

      {state.manualLink ? (
        <p className="mt-[8px] max-w-[68ch] break-all border-l-2 border-accent py-[2px] pl-[10px] font-mono text-[11.5px] leading-[1.55] text-accent">
          {state.manualLink}
        </p>
      ) : null}
    </form>
  );
}
