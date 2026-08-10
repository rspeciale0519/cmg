"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { TextField } from "@/components/forms/controls";
import { FormAlert, formAlertMessage } from "@/components/forms/form-feedback";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/lib/actions/invite";
import { idleState } from "@/lib/actions/types";
import { cx } from "@/lib/cx";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_SCORE_LABELS,
  passwordProblemMessage,
  passwordProblems,
  passwordScore,
} from "@/lib/validators/password";

/**
 * Four segments rather than a bar: a continuous bar invites the reader to aim
 * for "full", and the rule this form actually enforces is a threshold, not a
 * maximum. The live problem line under it is the same text the server would
 * return, computed from the same function, so the meter never promises
 * something the submit will refuse.
 */
function StrengthMeter({ password, email }: { password: string; email: string }) {
  const score = passwordScore(password, email);
  const problems = passwordProblems(password, email);

  return (
    <div className="mt-[10px]">
      <div className="flex gap-[6px]" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cx(
              "h-[3px] flex-1 rounded-full transition-colors duration-200",
              password.length === 0
                ? "bg-ink/13"
                : score >= step
                  ? score <= 1
                    ? "bg-[#E08C6A]"
                    : "bg-accent"
                  : "bg-ink/13",
            )}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className="mt-[8px] text-[13px] leading-[1.6] text-ink/55"
      >
        {password.length === 0
          ? `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a lowercase letter and a number.`
          : problems.length > 0
            ? passwordProblemMessage(problems[0])
            : PASSWORD_SCORE_LABELS[score]}
      </p>
    </div>
  );
}

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
  const [state, formAction, pending] = useActionState(acceptInvite, idleState);
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

      <div className="mt-5">
        <TextField
          name="password"
          label="Create a password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <StrengthMeter password={password} email={email} />
      </div>

      <TextField
        name="confirmPassword"
        label="Confirm password"
        type="password"
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
