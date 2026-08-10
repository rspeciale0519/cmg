import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Warm ember — the one hue in the warm family that cannot be mistaken for the
 *  gold accent at a glance. 5.8:1 on the canvas, so it carries text, not just a
 *  border. */
export const DANGER = "#E08C6A";

/** Prototype `.input`, with the 46px min-height these two pages set inline. */
export const INPUT_CLASS =
  "w-full min-h-[46px] rounded-md border border-ink/16 bg-surface px-[14px] py-[11px] text-[15px] leading-[1.5] text-ink caret-accent transition-colors duration-150 " +
  "placeholder:text-ink/35 hover:border-ink/45 focus-visible:border-accent focus-visible:outline-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-55";

export const INVALID_CLASS = "border-[#E08C6A] hover:border-[#E08C6A]";

export const LABEL_CLASS =
  "block text-xs leading-[1.4] text-ink/70";

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
    <p id={id} className="mt-[6px] text-[13px] leading-[1.6] text-ink/50">
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
