import Link from "next/link";
import { cx } from "@/lib/cx";

/**
 * Honest paging.
 *
 * "Showing 20 of 34" and not "34 entries" over a list of twenty — the count of
 * what is on screen and the count of what exists are two different numbers, and
 * printing only the second under a partial list is the small lie that makes a
 * reader stop trusting the rest of the page. `shown` and `total` are always both
 * stated when they differ.
 *
 * `Link` rather than a button: each page is a URL, so the browser's own back
 * button walks back through the feed and a page of it can be reopened later.
 * A missing direction renders as nothing at all rather than as a disabled
 * control — there is no page there, and a greyed arrow invites a click that
 * cannot go anywhere.
 */
export function PortalPager({
  label,
  noun,
  pluralNoun,
  shown,
  total,
  prevHref,
  nextHref,
  startHref,
}: {
  label: string;
  noun: string;
  pluralNoun: string;
  shown: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
  startHref: string | null;
}) {
  if (!prevHref && !nextHref && !startHref) return null;

  const unit = total === 1 ? noun : pluralNoun;
  const count =
    shown === total ? `${total} ${unit}` : `Showing ${shown} of ${total} ${unit}`;

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-ink/9 px-[clamp(18px,2.4vw,28px)] py-[14px]"
    >
      <p className="text-[12.5px] leading-[1.45] text-ink/42 tabular-nums">{count}</p>

      <div className="flex flex-wrap items-center gap-[7px]">
        {startHref ? <PagerLink href={startHref}>Newest</PagerLink> : null}
        {prevHref ? <PagerLink href={prevHref}>← Newer</PagerLink> : null}
        {nextHref ? <PagerLink href={nextHref}>Older →</PagerLink> : null}
      </div>
    </nav>
  );
}

function PagerLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex min-h-[40px] items-center rounded-md border border-ink/14 px-[14px] text-[13px] leading-[1.4] text-ink/72 no-underline",
        "transition-colors duration-200 hover:border-ink/32 hover:text-ink active:bg-ink/8",
      )}
    >
      {children}
    </Link>
  );
}
