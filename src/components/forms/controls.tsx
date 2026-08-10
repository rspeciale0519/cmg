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
  FILE_INPUT_CLASS,
  INPUT_CLASS,
  TEXTAREA_CLASS,
  type TextAreaSize,
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
        className={cx("mt-[6px]", INPUT_CLASS)}
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
  size = "md",
  ...textarea
}: Shared &
  Omit<ComponentPropsWithoutRef<"textarea">, "name" | "className" | "size"> & {
    /** The prototype's own min-height for this box: `md` = 130px (Contact),
     *  `sm` = 110px (intake). */
    size?: TextAreaSize;
  }) {
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
        className={cx("mt-[6px] resize-y", TEXTAREA_CLASS[size])}
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
          className={cx("appearance-none pr-11", INPUT_CLASS)}
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
  /** `""` is a group with no answer yet — no radio is `checked`, which is what
   *  an unanswered required question has to look like. */
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
      <legend className="block text-xs leading-[1.55] text-ink/72">
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
            /* `text-sm` ships a 20px leading pair; the prototype's `.radio`
               sets none and takes the body's 1.55 (21.7px). */
            className="group relative inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm leading-[1.55] text-ink"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              /* Carried by every radio in the group, which is how HTML marks a
                 radio *group* required — the legend's asterisk was the only
                 statement of it before, and an asterisk is not a semantic. */
              required={required}
              onChange={() => onValueChange(option.value)}
              /* Covers the whole label rather than collapsing to zero size, so
                 the real control is the hit target at its full 44px. */
              className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <span
              aria-hidden="true"
              className={cx(
                /* The checked state is drawn with an inset box-shadow, so
                   `transition-colors` alone left the dot's fill easing while
                   its centre punched in instantly. */
                "size-4 flex-none rounded-full border-[1.5px] border-ink/16",
                "transition-[color,background-color,border-color,box-shadow] duration-200",
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
        /* `group` and `relative` for the same reason `RadioField`'s label
           carries them: the real control covers the label and is invisible,
           and the drawn box reads hover off the label rather than off a
           control it cannot see. */
        className="group relative flex max-w-[66ch] cursor-pointer items-start gap-[14px] text-[15px] leading-[1.7] text-ink/78"
      >
        <input
          id={ids.inputId}
          name={name}
          type="checkbox"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(Boolean(error), false, ids)}
          /* Native, drawn over the whole label. `accent-color` on the stock
             box could tint the checked fill but nothing else: on an empty
             submit this control went `aria-invalid` alongside sixteen others
             and was the only one that could not show it, because Chrome's
             `appearance: auto` square takes no border. */
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={cx(
            /* 16px, the size the radios on this same page draw. The 6px the
               stock 18px box took centred it on nothing in particular; 5px
               sets a 16px box on the optical centre of a 25.5px first line. */
            "mt-[5px] size-4 flex-none rounded-sm border-[1.5px] border-ink/16",
            "transition-[color,background-color,border-color] duration-200",
            "group-hover:border-accent",
            "peer-checked:border-accent peer-checked:bg-accent",
            /* The tick is a child of this box, not a sibling of the input, so
               it cannot be reached by `peer-checked:` on its own. */
            "peer-checked:[&>svg]:opacity-100",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
            "peer-aria-invalid:border-[#E08C6A]",
          )}
        >
          <svg
            viewBox="0 0 16 16"
            className="size-full text-canvas opacity-0 transition-opacity duration-200"
          >
            <path
              d="M3.5 8.4 6.6 11.5 12.5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
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
          "mt-[6px] cursor-pointer text-ink/72",
          /* The button takes the height Chrome's own "Choose files" button
             takes in the prototype — 22px — so the control's box comes out at
             the prototype's 48px (22 + the 12px padding either side + the
             1px border either side). It was 61.5px on `py-[7px]`, which put a
             single file field 13.5px taller than the prototype and taller
             than any other control on the page. The accent skin stays; only
             its box matches. */
          "file:mr-4 file:h-[22px] file:cursor-pointer file:rounded-sm file:border file:border-accent/45 file:bg-transparent file:px-[10px] file:py-0 file:text-[13px] file:leading-[1.4] file:font-medium file:text-accent file:transition-colors file:duration-200 hover:file:bg-accent/12",
          FILE_INPUT_CLASS,
        )}
      />
      {hint ? <FieldHint id={ids.hintId}>{hint}</FieldHint> : null}
      <FieldError id={ids.errorId}>{error}</FieldError>
    </Field>
  );
}
