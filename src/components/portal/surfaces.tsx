import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * The portal's surface vocabulary.
 *
 * Deliberately not the workspace's `Panel`. That one is a desk: 11px uppercase
 * labels, 34px controls, 12.5px body, tuned for an adjuster scanning nine
 * claims. This is one person reading about one house, once, probably on a phone,
 * probably while something is still dripping — so the same materials (hairline
 * ink borders, the 38% surface fill, the gold accent hairline that opens every
 * section on the marketing site) are set at the marketing site's density: 15px
 * body on 1.75, and room around it.
 *
 * Same product, two densities, one set of marks.
 */

export function Panel({
  title,
  meta,
  children,
  className,
}: {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      /* `min-w-0` because a panel is routinely a grid item, and a grid item's
         default `min-width: auto` refuses to shrink below its content — a long
         file name or an unbroken carrier reference then widens the column
         rather than wrapping inside it. */
      className={cx("min-w-0 border border-ink/13 bg-surface/38", className)}
    >
      {title ? (
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink/9 px-[clamp(18px,2.4vw,28px)] py-[15px]">
          <h2 className="text-[15px] font-medium leading-[1.35] tracking-[-0.01em]">
            {title}
          </h2>
          {meta ? (
            <p className="text-[12px] leading-[1.45] text-ink/55">{meta}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("px-[clamp(18px,2.4vw,28px)] py-[clamp(18px,2.2vw,24px)]", className)}>
      {children}
    </div>
  );
}

/**
 * An empty screen is an invitation to act, not a shrug. Every use passes a
 * headline that says what is not there and a body that says what will put
 * something there — never "No results".
 */
export function EmptyState({
  headline,
  children,
}: {
  headline: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-[clamp(18px,2.4vw,28px)] py-[clamp(26px,3.4vw,38px)]">
      <p className="text-[15px] leading-[1.5] text-ink/78">{headline}</p>
      {children ? (
        <p className="mt-[8px] max-w-[52ch] text-[14px] leading-[1.7] text-ink/55">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A labelled fact. `<dl>` rather than a two-column grid of divs, because these
 * genuinely are term/description pairs and a screen reader reading "Date of loss
 * — May 18, 2026" is the whole point of the markup.
 */
export function FactList({
  items,
  className,
}: {
  items: ReadonlyArray<{ term: string; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cx("grid gap-[18px] sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.term} className="min-w-0">
          <dt className="text-[11px] uppercase leading-[1.4] tracking-[0.14em] text-ink/40">
            {item.term}
          </dt>
          <dd className="mt-[6px] text-[15px] leading-[1.6] text-ink/88">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The site's section mark: a 40px accent hairline. One per screen region. */
export function AccentRule({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cx("block h-px w-10 bg-accent", className)} />
  );
}
