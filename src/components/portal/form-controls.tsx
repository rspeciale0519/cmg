"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import type { FormState } from "@/lib/actions/types";
import { formAlertMessage } from "@/components/forms/form-feedback";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { cx } from "@/lib/cx";

/**
 * The two pieces every portal form needs and the marketing form components do
 * not carry: a submit button that says what it is doing, and the one line the
 * form says about itself afterwards.
 *
 * The fields themselves are `@/components/forms/controls` — the marketing
 * TextField / TextAreaField / SelectField / FileField, unchanged. A homeowner
 * filling in the intake form and a homeowner updating their phone number in the
 * portal are the same person at the same density, and a second set of 46px
 * controls would be the same control wearing a different name.
 */

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size="compact"
      disabled={pending}
      /* `aria-live` on the label rather than a spinner: the word changing from
         "Send question" to "Sending…" is the entire status, and it reaches a
         screen reader without a second announcement region. */
      aria-live="polite"
    >
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * What the form says after it resolves.
 *
 * `role="status"` on success and `role="alert"` on failure — a saved change is
 * information and a refusal interrupts, and giving both the same politeness
 * either shouts about a success or lets a failure pass silently.
 *
 * The failure line is `formAlertMessage`, shared with the marketing forms, so a
 * refusal with three field errors counts them ("3 fields need your attention")
 * instead of repeating what the three inline messages already say.
 */
export function FormFeedback({
  state,
  className,
}: {
  state: FormState;
  className?: string;
}) {
  if (state.status === "idle") return null;

  const success = state.status === "success";
  const message = success ? state.message : formAlertMessage(state);
  if (!message) return null;

  return (
    <p
      role={success ? "status" : "alert"}
      className={cx(
        "mt-[14px] flex gap-[8px] text-[14px] leading-[1.6]",
        success ? "text-accent" : "text-[#E08C6A]",
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-[4px] size-[13px] flex-none">
        {success ? (
          <path
            d="M3 8.4 6.4 11.8 13 4.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M8 1.5 15 14H1L8 1.5Zm0 4.6v3.6M8 11.4v.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span>{message}</span>
    </p>
  );
}
