"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "@/lib/cx";
import {
  describedBy,
  Field,
  FieldError,
  FieldHint,
  FieldLabel,
  fieldIds,
  INPUT_CLASS,
  INVALID_CLASS,
} from "./field";

type Shared = {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
};

export function TextField({
  name,
  label,
  error,
  hint,
  required,
  className,
  ...input
}: Shared & Omit<ComponentPropsWithoutRef<"input">, "name" | "className">) {
  const ids = fieldIds(name);

  return (
    <Field className={className}>
      <FieldLabel htmlFor={ids.inputId} required={required}>
        {label}
      </FieldLabel>
      <input
        {...input}
        id={ids.inputId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(Boolean(error), Boolean(hint), ids)}
        className={cx("mt-[6px]", INPUT_CLASS, error && INVALID_CLASS)}
      />
      {hint ? <FieldHint id={ids.hintId}>{hint}</FieldHint> : null}
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
}

export function TextAreaField({
  name,
  label,
  error,
  hint,
  required,
  className,
  ...textarea
}: Shared & Omit<ComponentPropsWithoutRef<"textarea">, "name" | "className">) {
  const ids = fieldIds(name);

  return (
    <Field className={className}>
      <FieldLabel htmlFor={ids.inputId} required={required}>
        {label}
      </FieldLabel>
      <textarea
        {...textarea}
        id={ids.inputId}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(Boolean(error), Boolean(hint), ids)}
        className={cx(
          "mt-[6px] resize-y",
          INPUT_CLASS,
          error && INVALID_CLASS,
        )}
      />
      {hint ? <FieldHint id={ids.hintId}>{hint}</FieldHint> : null}
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
}

/** Shown by a select that has no answer yet. Styled as a placeholder by the
 *  `select:has(option[value=""]:checked)` rule in globals.css, so an
 *  unanswered select reads the same weight as an unanswered text field. */
const SELECT_PLACEHOLDER = "Select…";

export function SelectField({
  name,
  label,
  error,
  hint,
  required,
  className,
  options,
  placeholder = true,
  ...select
}: Shared &
  Omit<ComponentPropsWithoutRef<"select">, "name" | "className"> & {
    options: ReadonlyArray<{ value: string; label: string }>;
    /** Set false where a real default is intended (e.g. State = Florida). */
    placeholder?: boolean;
  }) {
  const ids = fieldIds(name);
  /* A select with a value is answered by definition, so it cannot also carry
     an empty first option — otherwise the browser would have nothing to
     select and would silently fall back to the first real option. */
  const showPlaceholder =
    placeholder && select.defaultValue === undefined && select.value === undefined;

  return (
    <Field className={className}>
      <FieldLabel htmlFor={ids.inputId} required={required}>
        {label}
      </FieldLabel>
      <div className="relative mt-[6px]">
        <select
          {...select}
          defaultValue={showPlaceholder ? "" : select.defaultValue}
          id={ids.inputId}
          name={name}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(Boolean(error), Boolean(hint), ids)}
          className={cx(
            "appearance-none pr-11",
            INPUT_CLASS,
            error && INVALID_CLASS,
          )}
        >
          {showPlaceholder ? (
            <option value="" disabled>
              {SELECT_PLACEHOLDER}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none absolute right-[14px] top-1/2 size-4 -translate-y-1/2 text-accent"
        >
          <path
            d="M3 6l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="square"
          />
        </svg>
      </div>
      {hint ? <FieldHint id={ids.hintId}>{hint}</FieldHint> : null}
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
}

export function RadioField({
  name,
  label,
  error,
  hint,
  required,
  className,
  options,
  value,
  onValueChange,
}: Shared & {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const ids = fieldIds(name);

  return (
    <fieldset
      className={cx("min-w-0 border-0 p-0", className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(Boolean(error), Boolean(hint), ids)}
    >
      <legend className="block text-xs leading-[1.4] text-ink/70">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-[3px] text-accent">
            *
          </span>
        ) : null}
      </legend>
      <div className="mt-[10px] flex flex-wrap gap-x-7 gap-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="group relative inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ink"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onValueChange(option.value)}
              /* Covers the whole label rather than collapsing to zero size, so
                 the real control is the hit target at its full 44px. */
              className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <span
              aria-hidden="true"
              className={cx(
                "size-4 flex-none rounded-full border-[1.5px] border-ink/16 transition-colors duration-150",
                "group-hover:border-accent",
                "peer-checked:border-accent peer-checked:bg-accent peer-checked:shadow-[inset_0_0_0_4px_var(--color-canvas)]",
                "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
              )}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint ? <FieldHint id={ids.hintId}>{hint}</FieldHint> : null}
      <FieldError id={ids.errorId}>{error}</FieldError>
    </fieldset>
  );
}

export function CheckboxField({
  name,
  error,
  required,
  className,
  children,
}: {
  name: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const ids = fieldIds(name);

  return (
    <div className={cx("min-w-0", className)}>
      <label
        htmlFor={ids.inputId}
        className="flex max-w-[66ch] cursor-pointer items-start gap-[14px] text-[15px] leading-[1.7] text-ink/76"
      >
        <input
          id={ids.inputId}
          name={name}
          type="checkbox"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(Boolean(error), false, ids)}
          className="mt-[6px] size-[18px] flex-none accent-[var(--color-accent)]"
        />
        <span>{children}</span>
      </label>
      <FieldError id={ids.errorId}>{error}</FieldError>
    </div>
  );
}

export function FileField({
  name,
  label,
  error,
  hint,
  className,
  ...input
}: Shared & Omit<ComponentPropsWithoutRef<"input">, "name" | "className">) {
  const ids = fieldIds(name);

  return (
    <Field className={className}>
      <FieldLabel htmlFor={ids.inputId}>{label}</FieldLabel>
      <input
        {...input}
        type="file"
        id={ids.inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(Boolean(error), Boolean(hint), ids)}
        className={cx(
          "mt-[6px] cursor-pointer p-[11px] text-[14px] text-ink/70",
          "file:mr-4 file:cursor-pointer file:rounded-sm file:border file:border-accent/45 file:bg-transparent file:px-4 file:py-[7px] file:text-[13px] file:font-medium file:text-accent file:transition-colors hover:file:bg-accent/12",
          INPUT_CLASS,
          error && INVALID_CLASS,
        )}
      />
      {hint ? <FieldHint id={ids.hintId}>{hint}</FieldHint> : null}
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
}
