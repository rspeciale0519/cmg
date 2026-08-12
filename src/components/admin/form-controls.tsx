"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/actions/types";
import { cx } from "@/lib/cx";

/**
 * The workspace's own control metrics. Deliberately not the marketing forms':
 * those are 46px boxes on a page a homeowner fills in once, and this is a desk
 * where an adjuster changes four fields and moves on. 34px, 13px type, and the
 * same border grammar — hairline at rest, `ink/40` on hover, accent on focus,
 * ember when invalid — so the two surfaces read as one product at two
 * densities.
 *
 * The `aria-invalid:` variants are spelled out rather than appended at the call
 * site for the reason `field.tsx` documents: `border-ink/15` and a bare
 * `border-[#E08C6A]` are equal-specificity single-class selectors, so which one
 * paints is decided by Tailwind's emit order rather than by the author.
 */
const CONTROL =
  "w-full rounded-md border border-ink/15 bg-canvas/70 px-[9px] text-[13px] leading-[1.5] text-ink caret-accent " +
  "transition-[color,background-color,border-color,opacity] duration-150 " +
  "placeholder:text-ink/32 hover:border-ink/40 focus-visible:border-accent focus-visible:outline-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-invalid:border-[#E08C6A] aria-invalid:hover:border-[#E08C6A] " +
  "aria-invalid:focus-visible:border-[#E08C6A] aria-invalid:focus-visible:outline-[#E08C6A]";

const CONTROL_BOX = `${CONTROL} min-h-[34px] py-[6px]`;

export function AdminLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-[5px] block text-[11px] uppercase leading-[1.4] tracking-[0.13em] text-ink/45"
    >
      {children}
      {hint ? (
        <span className="ml-2 normal-case tracking-normal text-ink/32">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * The one sentence under a refused field. Its `id` is the other half of the
 * `aria-describedby` the controls below set, so it is a component rather than
 * markup repeated at each call site — a field whose error paragraph is spelled
 * out by hand is a field one typo away from describing nothing.
 */
export function FieldError({ name, children }: { name: string; children?: string }) {
  if (!children) return null;

  return (
    <p
      id={`admin-${name}-error`}
      className="mt-[5px] text-[12px] leading-[1.45] text-[#E08C6A]"
    >
      {children}
    </p>
  );
}

export function AdminField({
  name,
  label,
  hint,
  error,
  children,
  className,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <AdminLabel htmlFor={`admin-${name}`} hint={hint}>
        {label}
      </AdminLabel>
      {children}
      <FieldError name={name}>{error}</FieldError>
    </div>
  );
}

export function AdminInput({
  name,
  error,
  className,
  ...props
}: { name: string; error?: string; className?: string } & Omit<
  ComponentPropsWithoutRef<"input">,
  "name" | "className"
>) {
  return (
    <input
      {...props}
      id={`admin-${name}`}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `admin-${name}-error` : undefined}
      className={cx(CONTROL_BOX, className)}
    />
  );
}

export function AdminTextarea({
  name,
  error,
  className,
  ...props
}: { name: string; error?: string; className?: string } & Omit<
  ComponentPropsWithoutRef<"textarea">,
  "name" | "className"
>) {
  return (
    <textarea
      {...props}
      id={`admin-${name}`}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `admin-${name}-error` : undefined}
      className={cx(CONTROL, "min-h-[76px] py-[7px]", className)}
    />
  );
}

/**
 * The chevron is a real SVG behind the control rather than a `background-image`
 * data URI in a Tailwind arbitrary value. The data-URI route is the usual one
 * and it does not survive this toolchain: the class has to carry quotes around
 * a `url()` whose payload is itself full of percent-encoded quotes, and
 * Lightning CSS parses the escaped result as `BadUrl` and drops the
 * declaration — a chevron that silently is not there, warned about at build
 * time and invisible at runtime.
 *
 * An element also buys something the background could not: `peer-focus` can
 * light it with the border, and `aria-hidden` keeps it out of the accessibility
 * tree, where a decorative glyph on a native `<select>` has no business.
 *
 * `key={props.defaultValue}` on the element is the fix for a bug that has no
 * equivalent on `<input>` or `<textarea>`, and it is not cosmetic.
 *
 * React's post-action form reset restores each control to its *default*, which
 * for a select means whichever `<option>` carries `defaultSelected`. For an
 * input or a textarea React re-applies a changed `defaultValue` on every
 * update; for an uncontrolled select it does not — `updateSelect` re-runs
 * `updateOptions` only when the select is controlled or when `multiple` itself
 * changed, so `defaultSelected` stays wherever the *first* render put it, for
 * the life of the element. Handing an echoed value back through `defaultValue`
 * therefore did nothing at all: the reset kept landing on the mount-time
 * option, which is how a refused staff invitation turned a chosen Assistant
 * back into an Adjuster. Keying the element makes a changed default a new
 * element, so React runs the mount path and sets `defaultSelected` properly.
 *
 * The key changes only when the server hands back a different default, which
 * is to say only when an action has just resolved — never mid-typing, so
 * nothing the operator is holding is thrown away.
 */
export function AdminSelect({
  name,
  error,
  className,
  children,
  ...props
}: {
  name: string;
  error?: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"select">, "name" | "className" | "children">) {
  return (
    <span className="relative block">
      <select
        {...props}
        key={String(props.defaultValue ?? "")}
        id={`admin-${name}`}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `admin-${name}-error` : undefined}
        className={cx(CONTROL_BOX, "peer appearance-none pr-8", className)}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-[9px] top-1/2 size-[14px] -translate-y-1/2 text-accent/75 transition-colors duration-150 peer-hover:text-accent peer-focus-visible:text-accent"
      >
        <path
          d="M3 6l5 5 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="square"
        />
      </svg>
    </span>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md border " +
  "text-[13px] font-medium leading-[1.4] no-underline " +
  "transition-[color,background-color,border-color,opacity] duration-150 " +
  "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent";

const BUTTON_VARIANT = {
  primary: "border-accent text-accent hover:bg-accent/12 active:bg-accent/22",
  secondary: "border-ink/16 text-ink/80 hover:border-ink/32 hover:text-ink active:bg-ink/10",
  danger: "border-[#E08C6A]/55 text-[#E8A98D] hover:bg-[#E08C6A]/12 active:bg-[#E08C6A]/20",
  quiet: "border-transparent text-ink/58 hover:text-ink hover:bg-ink/8",
} as const;

export type AdminButtonVariant = keyof typeof BUTTON_VARIANT;

/**
 * Pending state is read from `useFormStatus`, so it belongs to the form rather
 * than to a piece of local state that can disagree with it. The label changes
 * to the present participle rather than to a spinner: a workspace action takes
 * 200ms and a spinner that flashes for 200ms is noise, while a verb tense the
 * reader can catch is not.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  disabled,
  ...props
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: AdminButtonVariant;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children" | "type">) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={cx(
        BUTTON_BASE,
        BUTTON_VARIANT[variant],
        "min-h-[34px] px-[13px]",
        className,
      )}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function AdminButton({
  children,
  variant = "secondary",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: AdminButtonVariant;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">) {
  return (
    <button
      {...props}
      className={cx(
        BUTTON_BASE,
        BUTTON_VARIANT[variant],
        "min-h-[34px] px-[13px]",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * The one line a form says about itself after submitting. `role="status"` for
 * success and `role="alert"` for failure, because the two are announced
 * differently and a failed status change is worth interrupting for.
 */
export function ActionFeedback({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;

  const failed = state.status === "error";

  return (
    <p
      role={failed ? "alert" : "status"}
      className={cx(
        "mt-[10px] flex gap-2 border-l-2 py-[2px] pl-[10px] text-[12.5px] leading-[1.55]",
        failed
          ? "border-[#E08C6A] text-[#E8A98D]"
          : "border-accent text-ink/72",
      )}
    >
      {state.message}
    </p>
  );
}
