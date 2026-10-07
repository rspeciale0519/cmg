import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Warm ember — the one hue in the warm family that cannot be mistaken for the
 *  gold accent at a glance. 5.8:1 on the canvas, so it carries text, not just a
 *  border. */
export const DANGER = "#E08C6A";

/* ── `ink/35`: a decision, not an oversight ──────────────────────────────
   `placeholder:text-ink/35` here, the `Select…` option and the date/time
   skeletons in `globals.css` all sit at 2.84:1 and all three stay there.

   They are the empty state, not content: every control on both forms carries
   a real, permanently visible `<label>` at `ink/72`, so nothing about the
   field's purpose is being carried at 2.84:1 — WCAG 1.4.3 exempts a
   placeholder only when the label does that work, and it does. Raising them
   to a text-tier ratio makes an unanswered field render at the same weight as
   an answered one, which is precisely the defect the datetime-skeleton and
   empty-select rules in `globals.css` were added to fix: on a 17-field intake
   the fastest read of "what is left to do" is the pale ink, and flattening it
   costs more than it buys. Do not raise these. */

/** Prototype `.input`, with the 46px min-height these two pages set inline.
 *
 *  The invalid state is a variant on this one string, never a second class
 *  appended beside it. `border-ink/16` and a bare `border-[#E08C6A]` are both
 *  single-class selectors — equal specificity — so which one paints is decided
 *  by stylesheet emit order, not by the order they appear in `class`. Tailwind
 *  emitted the danger utility ~133 rules ahead of `border-ink/16`, so the
 *  resting border won and the error border never rendered. `aria-invalid:`
 *  compiles to `[aria-invalid="true"]`, which outranks the resting border on
 *  specificity and is therefore order-independent. The hover and focus pairs
 *  are spelled out for the same reason: `hover:border-ink/45` and
 *  `focus-visible:border-accent` would otherwise tie with it. */
/** Everything about the control except its padding and its min-height.
 *
 *  Both are held out for the same reason: the variants differ (the file input
 *  takes the prototype's `12px` where the text control takes `6px 10px`; the
 *  two textareas take the prototype's own 130px and 110px where every other
 *  control takes 46px) and neither can be overridden by appending a utility.
 *  `p-*` vs `px-*`/`py-*` and one `min-h-*` vs another are equal-specificity
 *  single-class selectors, so the emitted sheet decides and the appended
 *  utility is silently inert — which is exactly how the two textareas lost
 *  their heights and fell back to this string's 46px.
 *
 *  `leading-[1.55]` is the prototype's: `.input` sets `font: inherit` before
 *  its own `font-size: 14px`, so it inherits the body's 1.55 line-height as a
 *  unitless number and resolves it against 14px — 21.7px, not the 21px a flat
 *  1.5 gives.
 *
 *  `opacity` is inside the transition list, not outside it: `disabled:` and
 *  the border states change together when a submit starts, and a border that
 *  eases while the fill snaps reads as two separate events. 200ms is the
 *  site's one navigational duration.
 *
 *  `aria-invalid:focus-visible:outline-[#E08C6A]` re-colours the global gold
 *  focus ring on an invalid control. A failed submit focuses the first
 *  invalid field, and with the base `:focus-visible` gold outline sitting
 *  outside the 1px ember border, the one field the form just sent the user to
 *  read *calmer* than its unfocused invalid neighbours. */
const INPUT_BASE =
  "w-full rounded-md border border-ink/16 bg-surface text-[14px] leading-[1.55] text-ink caret-accent " +
  "transition-[color,background-color,border-color,opacity] duration-200 " +
  "placeholder:text-ink/35 hover:border-ink/45 focus-visible:border-accent focus-visible:outline-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-55 " +
  "aria-invalid:border-[#E08C6A] aria-invalid:hover:border-[#E08C6A] aria-invalid:focus-visible:border-[#E08C6A] " +
  "aria-invalid:focus-visible:outline-[#E08C6A]";

/** Prototype `.input`: 14px on `6px 10px`. The 46px min-height these two
 *  pages set inline is what gives the box its size, so the padding is free to
 *  be the prototype's — 15px on `11px 14px` was a second, larger control
 *  wearing the same name. */
export const INPUT_CLASS = `${INPUT_BASE} min-h-[46px] px-[10px] py-[6px]`;

/** The text control with room on the right for the 44px show/hide button, so
 *  typed characters never run under it. Written as a whole string for the
 *  reason `INPUT_BASE` documents: a `pr-*` appended beside `px-[10px]` ties on
 *  specificity and the emitted sheet decides which one paints.
 *
 *  `::-ms-reveal` is Edge's own eye button. Left in place it would draw a
 *  second toggle beside this one. */
export const PASSWORD_INPUT_CLASS =
  `${INPUT_BASE} min-h-[46px] py-[6px] pl-[10px] pr-[50px] [&::-ms-reveal]:hidden`;

/** The prototype's file control, which overrides `.input`'s padding to 12px
 *  so the native "Choose files" button has room to sit in. */
export const FILE_INPUT_CLASS = `${INPUT_BASE} min-h-[46px] p-[12px]`;

/** The two textareas the prototypes size themselves: Contact's "What
 *  happened?" at 130px and the intake's "Description of the loss" at 110px.
 *  Written out as whole strings rather than a `min-h-*` appended at the call
 *  site, for the reason `INPUT_BASE` documents. */
export const TEXTAREA_CLASS = {
  sm: `${INPUT_BASE} min-h-[110px] px-[10px] py-[6px]`,
  md: `${INPUT_BASE} min-h-[130px] px-[10px] py-[6px]`,
} as const;

export type TextAreaSize = keyof typeof TEXTAREA_CLASS;

/* 12px on the body's inherited 1.55 (18.6px), which is what the prototype's
   `.field > label` takes. `leading-[1.4]` closed it to 16.8px. */
export const LABEL_CLASS =
  "block text-xs leading-[1.55] text-ink/72";

export function fieldIds(name: string) {
  return {
    inputId: `field-${name}`,
    errorId: `field-${name}-error`,
    hintId: `field-${name}-hint`,
  };
}

export function describedBy(
  hasError: boolean,
  hasHint: boolean,
  ids: ReturnType<typeof fieldIds>,
): string | undefined {
  const parts = [hasError ? ids.errorId : null, hasHint ? ids.hintId : null].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function FieldLabel({
  htmlFor,
  children,
  required,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cx(LABEL_CLASS, className)}>
      {children}
      {required ? (
        <span aria-hidden="true" className="ml-[3px] text-accent">
          *
        </span>
      ) : null}
    </label>
  );
}

export function FieldError({ id, children }: { id: string; children?: string }) {
  if (!children) return null;

  return (
    <p id={id} className="mt-[6px] flex gap-[6px] text-[13px] leading-[1.5] text-[#E08C6A]">
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="mt-[3px] size-[13px] flex-none"
      >
        <path
          d="M8 1.5 15 14H1L8 1.5Zm0 4.6v3.6M8 11.4v.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{children}</span>
    </p>
  );
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-[6px] text-[13px] leading-[1.6] text-ink/55">
      {children}
    </p>
  );
}

export function Field({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx("min-w-0", className)}>{children}</div>;
}
