import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type FaqItemProps = {
  question: string;
  className?: string;
  children: ReactNode;
};

export function FaqItem({ question, className, children }: FaqItemProps) {
  return (
    <details
      className={cx("group border-t border-ink/11 last:border-b", className)}
    >
      {/* The prototype's `padding: 24px 0` and its inherited 1.55 leading —
          the question is body-tier ink, not a heading, and setting it tighter
          than the answer below it made the two read as different voices. */}
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-6 py-6 text-[19px] font-medium leading-[1.55] tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 flex-none text-accent transition-transform duration-200 group-open:rotate-180"
        >
          <path
            d="M3 6l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="square"
          />
        </svg>
      </summary>
      <div className="max-w-[62ch] pb-6 text-base leading-[1.75] text-ink/72">
        {children}
      </div>
    </details>
  );
}
