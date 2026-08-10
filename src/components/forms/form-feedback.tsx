import type { ReactNode, Ref } from "react";
import { cx } from "@/lib/cx";

/**
 * The prototype's success panel: accent hairline, 45%-accent border, 7%-accent
 * wash. `tabIndex={-1}` because the form moves focus here on success, so a
 * screen-reader user lands on the confirmation rather than on a vanished form.
 */
export function SuccessPanel({
  heading,
  headingSize = "md",
  className,
  ref,
  children,
}: {
  heading: string;
  headingSize?: "md" | "lg";
  className?: string;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className={cx(
        "border border-accent/45 bg-accent/7 outline-none",
        headingSize === "lg"
          ? "p-[clamp(28px,3.5vw,48px)]"
          : "p-[clamp(24px,3vw,40px)]",
        className,
      )}
    >
      <span aria-hidden="true" className="mb-[22px] block h-px w-10 bg-accent" />
      <h2
        className={cx(
          "m-0 font-medium leading-[1.2]",
          headingSize === "lg"
            ? "text-[28px] tracking-[-0.025em]"
            : "text-[24px] tracking-[-0.02em]",
        )}
      >
        {heading}
      </h2>
      {children}
    </div>
  );
}

export function SuccessBody({ children }: { children: ReactNode }) {
  return (
    <p className="mt-[18px] text-base leading-[1.75] text-ink/78">{children}</p>
  );
}

/** Submission-level failure — Turnstile, rate limit, or a server fault. */
export function FormAlert({
  message,
  ref,
}: {
  message?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  if (!message) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="mb-6 flex gap-3 border border-[#E08C6A]/50 bg-[#E08C6A]/8 p-4 text-[14px] leading-[1.65] text-ink/85 outline-none"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="mt-[2px] size-4 flex-none text-[#E08C6A]"
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
      <span>{message}</span>
    </div>
  );
}
