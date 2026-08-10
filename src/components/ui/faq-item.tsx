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
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-6 py-[22px] text-[19px] font-medium leading-[1.35] tracking-[-0.015em] [&::-webkit-details-marker]:hidden">
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
