import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A form that is available but not in the way. Adding a company or inviting a
 * rep is the rarest thing done on these screens and the widest control on them,
 * so it opens rather than sitting permanently above the list it would otherwise
 * push off the fold.
 *
 * Native `<details>`, not a `useState` panel: it needs no JavaScript, it is
 * open-able before hydration, and screen readers already announce its expanded
 * state without an `aria-expanded` that has to be kept in sync by hand. The
 * marketing site's FAQ uses the same element — this is that idiom at workspace
 * density.
 */
export function FormDisclosure({
  summary,
  hint,
  children,
  className,
}: {
  summary: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cx("group border border-ink/11 bg-surface/38", className)}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-[clamp(14px,1.6vw,20px)] py-[12px] text-[13px] leading-[1.4] text-ink/78 transition-colors duration-150 hover:text-ink [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-[13px] flex-none text-accent transition-[rotate] duration-200 group-open:rotate-45"
        >
          <path
            d="M8 3v10M3 8h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="square"
          />
        </svg>
        <span className="font-medium">{summary}</span>
        {hint ? (
          <span className="text-[12px] text-ink/58 group-open:hidden">{hint}</span>
        ) : null}
      </summary>
      <div className="border-t border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[clamp(14px,1.6vw,18px)]">
        {children}
      </div>
    </details>
  );
}
