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
      {/* The row was the site's one interactive surface with no pointer
          response — the cursor was the whole of the feedback. It answers on
          the same 200ms ramp every other link uses. The chevron reads the
          summary's own hover, not the `<details>` group's: hovering an open
          answer is not hovering its control. */}
      {/* `:active` because the row is a touch target first: hover is the
          whole of the feedback on a pointer, and nothing at all on a phone.
          Same 300 → 200 accent step the nav and prose links take. */}
      <summary className="group/summary flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-6 py-6 text-[19px] font-medium leading-[1.55] tracking-[-0.015em] transition-colors duration-200 hover:text-accent-300 active:text-accent-200 [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          /* `rotate`, not `transform`: Tailwind v4's `rotate-180` sets the
             individual `rotate` property, which a `transition-transform`
             list does not cover — naming `transform` here would let the
             chevron snap through 180° in one frame. */
          className="size-4 flex-none text-accent transition-[rotate,color] duration-200 group-open:rotate-180 group-hover/summary:text-accent-300 group-active/summary:text-accent-200"
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
