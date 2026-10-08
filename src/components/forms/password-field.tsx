"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import {
  describedBy,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  fieldIds,
  PASSWORD_INPUT_CLASS,
} from "./field";

type PasswordFieldProps = {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"input">, "name" | "className" | "type">;

/**
 * `TextField` for a secret, with a show/hide button inside the right edge.
 *
 * Hidden by default, and hidden again whenever the form submits: a field left
 * showing after a refused submit would keep a password on screen, and a
 * browser decides whether to offer to save a password partly from
 * `type="password"` at submit time.
 *
 * The button is `type="button"` so it can never submit the form, and focus
 * stays on it after a press — no other control here moves focus on toggle.
 * Nothing about the input's own wiring changes: `name`, `autoComplete`,
 * `required`, the label and the error/hint `aria-describedby` are exactly what
 * `TextField` gives them, so password managers and the error display are
 * unaffected. Passwords are never echoed back by an action; this component
 * takes no part in that.
 */
export function PasswordField({
  name,
  label,
  error,
  hint,
  required,
  className,
  disabled,
  ...input
}: PasswordFieldProps) {
  const ids = fieldIds(name);
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  return (
    <Field className={className}>
      <FieldLabel htmlFor={ids.inputId} required={required}>
        {label}
      </FieldLabel>
      <div className="relative mt-[6px]">
        <input
          {...input}
          ref={inputRef}
          type={visible ? "text" : "password"}
          id={ids.inputId}
          name={name}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(Boolean(error), Boolean(hint), ids)}
          className={PASSWORD_INPUT_CLASS}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={ids.inputId}
          className={cx(
            "absolute right-[1px] top-1/2 inline-flex size-[44px] -translate-y-1/2 items-center justify-center rounded-md",
            "cursor-pointer text-ink/55 transition-colors duration-200 hover:text-accent",
            "focus-visible:text-accent focus-visible:outline-offset-[-2px]",
            "disabled:cursor-not-allowed disabled:opacity-55",
          )}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint ? <FieldHint id={ids.hintId}>{hint}</FieldHint> : null}
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      data-icon="eye"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      data-icon="eye-off"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-2.8 3.8" />
      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
