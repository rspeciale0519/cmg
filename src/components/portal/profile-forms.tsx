"use client";

import { useActionState } from "react";
import { TextField } from "@/components/forms/controls";
import { changePassword, updateProfile } from "@/lib/actions/portal";
import { idleState } from "@/lib/actions/types";
import { FormFeedback, SubmitButton } from "./form-controls";

/**
 * Name and phone. `noValidate` for the reason every form in this codebase
 * carries it: Chrome's native bubble stops at the first invalid field and
 * bypasses the inline error system entirely, so a form that kept it would refuse
 * in a different visual language from every other form in the product.
 *
 * Each field re-seeds from `state.values` first and the stored profile second.
 * That order is what makes a refusal keep the edit: React 19 resets a form when
 * its action resolves, so without the echo a rejected phone number would snap
 * back to the old one under a message asking the person to fix the new one.
 * On success `values` is absent and the fields re-seed from the server — which
 * is now the value that was just saved.
 */
export function ProfileForm({
  profile,
  email,
}: {
  profile: { first_name: string | null; last_name: string | null; phone: string | null };
  email: string | null;
}) {
  const [state, formAction] = useActionState(updateProfile, idleState);

  return (
    <form action={formAction} noValidate>
      <div className="grid gap-[18px] sm:grid-cols-2">
        <TextField
          name="firstName"
          label="First name"
          required
          autoComplete="given-name"
          maxLength={80}
          defaultValue={state.values?.firstName ?? profile.first_name ?? ""}
          error={state.fieldErrors?.firstName}
        />
        <TextField
          name="lastName"
          label="Last name"
          required
          autoComplete="family-name"
          maxLength={80}
          defaultValue={state.values?.lastName ?? profile.last_name ?? ""}
          error={state.fieldErrors?.lastName}
        />
        <TextField
          name="phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          defaultValue={state.values?.phone ?? profile.phone ?? ""}
          error={state.fieldErrors?.phone}
          hint="The number we call about this claim. Leave it empty to be reached by email only."
          className="sm:col-span-2"
        />
      </div>

      {/* Email is shown and not editable, and the sentence says why rather than
          leaving a greyed-out box to be argued with. Changing a sign-in address
          re-points an account, which is a support action with an identity check
          behind it, not a text field. */}
      <p className="mt-[18px] text-[13px] leading-[1.7] text-ink/55">
        You sign in as <span className="text-ink/72">{email ?? "—"}</span>. To change
        the address on your account, call us — we verify it with you first.
      </p>

      <div className="mt-[20px]">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>

      <FormFeedback state={state} />
    </form>
  );
}

/**
 * Change the password.
 *
 * Nothing is ever re-seeded here, and the omission is the point: `values` exists
 * to hand back what a person typed, and all three fields are secrets — echoing
 * them would put a password into rendered HTML and into the React payload on the
 * wire to save retyping something a password manager fills anyway. The action
 * returns no `values` for this form for the same reason.
 *
 * `autoComplete` is spelled out per field so a password manager offers to update
 * the stored entry rather than treating this as a second login form.
 */
export function PasswordForm() {
  const [state, formAction] = useActionState(changePassword, idleState);

  return (
    <form action={formAction} noValidate>
      <div className="grid gap-[18px]">
        <TextField
          name="currentPassword"
          label="Current password"
          type="password"
          required
          autoComplete="current-password"
          error={state.fieldErrors?.currentPassword}
        />
        <TextField
          name="newPassword"
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          error={state.fieldErrors?.newPassword}
          hint="At least 12 characters, with upper and lower case letters and a number."
        />
        <TextField
          name="confirmPassword"
          label="Repeat the new password"
          type="password"
          required
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
        />
      </div>

      <div className="mt-[20px]">
        <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
      </div>

      <FormFeedback state={state} />
    </form>
  );
}
