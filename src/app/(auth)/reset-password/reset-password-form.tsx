"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { TextField } from "@/components/forms/controls";
import { PasswordField } from "@/components/forms/password-field";
import { FormAlert, formAlertMessage } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { resetPassword } from "@/lib/actions/password-reset";
import { idleState, resilient } from "@/lib/actions/types";

export function ResetPasswordForm({
  email,
  needsCode,
}: {
  email: string;
  needsCode: boolean;
}) {
  const [state, formAction, pending] = useActionState(resilient(resetPassword), idleState);
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== "error") return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    (firstInvalid ?? alertRef.current)?.focus();
  }, [state]);

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate>
      <FormAlert message={formAlertMessage(state)} ref={alertRef} />

      <div className="mb-5 border-b border-ink/13 pb-5">
        <p className="text-xs leading-[1.55] text-ink/72">Account</p>
        <p className="mt-[6px] text-[15px] leading-[1.6] text-ink">{email}</p>
      </div>

      {needsCode ? (
        <TextField
          name="code"
          label="6-digit code from your authenticator app"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          className="mb-5"
          error={errors.code}
        />
      ) : null}

      <div>
        <PasswordField
          name="password"
          label="New password"
          required
          autoFocus={!needsCode}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <PasswordStrengthMeter password={password} email={email} />
      </div>

      <PasswordField
        name="confirmPassword"
        label="Confirm new password"
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
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
