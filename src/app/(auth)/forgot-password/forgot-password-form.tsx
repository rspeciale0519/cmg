"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { TextField } from "@/components/forms/controls";
import {
  FormAlert,
  formAlertMessage,
  SuccessBody,
  SuccessPanel,
} from "@/components/forms/form-feedback";
import { TurnstileWidget } from "@/components/forms/turnstile";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import { idleState, resilient } from "@/lib/actions/types";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    resilient(requestPasswordReset),
    idleState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      successRef.current?.focus();
      return;
    }
    if (state.status !== "error") return;
    const firstInvalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    (firstInvalid ?? alertRef.current)?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <SuccessPanel heading="Check your email." ref={successRef}>
        <SuccessBody>{state.message}</SuccessBody>
        <p className="mt-[14px] text-[14px] leading-[1.7] text-ink/65">
          The link works once and expires in one hour.{" "}
          <Link href="/login" className="text-accent underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      </SuccessPanel>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate>
      <FormAlert message={formAlertMessage(state)} ref={alertRef} />

      <TextField
        name="email"
        label="Email"
        type="email"
        required
        autoComplete="username"
        autoFocus
        defaultValue={state.values?.email ?? ""}
        error={errors.email}
      />

      <div className="mt-6">
        <TurnstileWidget resetOn={state} />
      </div>

      <Button
        type="submit"
        size="md"
        disabled={pending}
        aria-busy={pending}
        className="mt-7 w-full"
      >
        {pending ? "Sending…" : "Email me a reset link"}
      </Button>
    </form>
  );
}
