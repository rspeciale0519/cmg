"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TextField } from "@/components/forms/controls";
import { PasswordField } from "@/components/forms/password-field";
import { FormAlert, formAlertMessage } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { acceptInvite } from "@/lib/actions/invite";
import { idleState, resilient } from "@/lib/actions/types";

export function InviteForm({
  token,
  email,
  firstName,
  lastName,
}: {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
}) {
  const [state, formAction, pending] = useActionState(resilient(acceptInvite), idleState);
  const [password, setPassword] = useState("");
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") alertRef.current?.focus();
  }, [state]);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate>
      <FormAlert message={formAlertMessage(state)} ref={alertRef} />

      <input type="hidden" name="token" value={token} />

      <div className="mb-5 border-b border-ink/13 pb-5">
        <p className="text-xs leading-[1.55] text-ink/72">Invitation sent to</p>
        <p className="mt-[6px] text-[15px] leading-[1.6] text-ink">{email}</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-5">
        <TextField
          name="firstName"
          label="First name"
          required
          defaultValue={firstName}
          autoComplete="given-name"
          error={errors.firstName}
        />
        <TextField
          name="lastName"
          label="Last name"
          required
          defaultValue={lastName}
          autoComplete="family-name"
          error={errors.lastName}
        />
      </div>

      {/* Shown to everyone, on purpose. An address that already has an account
          keeps its own password — `acceptInvite` never changes it, since the
          link proves nothing about the account — and the person is sent to
          sign in with it. Showing this only to them would tell anyone holding
          the link whether an account exists before it is redeemed. */}
      <p
        id="invite-existing-account-hint"
        className="mt-5 border-l-2 border-accent/60 pl-[12px] text-[13px] leading-[1.6] text-ink/72"
      >
        Already have a CMG account with this email? Your password will not
        change. Keep using the password you have now. After you click &ldquo;Set
        my password,&rdquo; we will ask you to sign in with it.
      </p>

      <div className="mt-5">
        <PasswordField
          name="password"
          label="Create a password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <PasswordStrengthMeter password={password} email={email} />
      </div>

      <PasswordField
        name="confirmPassword"
        label="Confirm password"
        required
        autoComplete="new-password"
        className="mt-5"
        error={errors.confirmPassword}
      />

      <Button
        type="submit"
        size="md"
        disabled={pending}
        aria-busy={pending}
        className="mt-7 w-full"
      >
        {pending ? "Setting up your account…" : "Set my password"}
      </Button>
    </form>
  );
}
