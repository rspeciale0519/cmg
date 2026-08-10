import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Warm ember — the one hue in the warm family that cannot be mistaken for the
 *  gold accent at a glance. 5.8:1 on the canvas, so it carries text, not just a
 *  border. */
export const DANGER = "#E08C6A";

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
/** Everything about the control except its padding.
 *
 *  Padding is held out because the file input needs its own (the prototype
 *  gives it `12px` where the text control gets `6px 10px`) and a `p-*`
 *  utility cannot beat a `px-*`/`py-*` one: they are equal specificity and
 *  Tailwind emits the axis utilities last, so a `p-[12px]` appended beside
 *  this string would be silently inert.
 *
 *  `opacity` is inside the transition list, not outside it: `disabled:` and
 *  the border states change together when a submit starts, and a border that
 *  eases while the fill snaps reads as two separate events. 200ms is the
 *  site's one navigational duration. */
const INPUT_BASE =
  "w-full min-h-[46px] rounded-md border border-ink/16 bg-surface text-[14px] leading-[1.5] text-ink caret-accent " +
  "transition-[color,background-color,border-color,opacity] duration-200 " +
  "placeholder:text-ink/35 hover:border-ink/45 focus-visible:border-accent focus-visible:outline-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-55 " +
  "aria-invalid:border-[#E08C6A] aria-invalid:hover:border-[#E08C6A] aria-invalid:focus-visible:border-[#E08C6A]";

/** Prototype `.input`: 14px on `6px 10px`. The 46px min-height these two
 *  pages set inline is what gives the box its size, so the padding is free to
 *  be the prototype's — 15px on `11px 14px` was a second, larger control
 *  wearing the same name. */
export const INPUT_CLASS = `${INPUT_BASE} px-[10px] py-[6px]`;

/** The prototype's file control, which overrides `.input`'s padding to 12px
 *  so the native "Choose files" button has room to sit in. */
export const FILE_INPUT_CLASS = `${INPUT_BASE} p-[12px]`;

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
