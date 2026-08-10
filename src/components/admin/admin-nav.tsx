"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { isAdminRouteActive, type AdminNavItem } from "./nav";

export type NavCounts = { intake: number; leads: number };

/**
 * A horizontal rail rather than a sidebar, and that is a decision rather than a
 * default. The workspace has eight destinations, not thirty, so the depth a
 * sidebar buys is depth this IA does not have — while the content is
 * table-shaped and genuinely wide: reference, homeowner, property, status,
 * adjuster, partner and last-touched are seven columns an adjuster reads
 * together. A 240px rail would take the property address, which is how a file
 * is recognised at a glance. The horizontal bar costs 48px of height once.
 *
 * Active state is a 2px accent rule sitting *on* the container's hairline, so
 * the marker reads as part of the page's structure rather than as a badge
 * stuck to a link. It scrolls horizontally on a phone and never wraps: a nav
 * that reflows to two rows moves every item the moment a badge count changes
 * from 9 to 10.
 */
export function AdminNav({
  items,
  counts,
}: {
  items: AdminNavItem[];
  counts: NavCounts;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Workspace"
      className="border-b border-ink/10 bg-canvas/82 backdrop-blur-[14px]"
    >
      <div className="mx-auto w-full max-w-[1440px] overflow-x-auto px-[clamp(16px,3vw,40px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex min-w-max items-stretch gap-1">
          {items.map((item) => {
            const active = isAdminRouteActive(pathname, item.href);
            const count = item.badge ? counts[item.badge] : 0;

            return (
              <li key={item.href} className="flex">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex items-center gap-2 whitespace-nowrap px-3 py-[14px] text-[13px] leading-[1.4] no-underline",
                    "transition-colors duration-150",
                    "after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:content-['']",
                    active
                      ? "text-ink after:bg-accent"
                      : "text-ink/58 after:bg-transparent hover:text-ink/90 hover:after:bg-ink/20",
                  )}
                >
                  {item.label}
                  {item.badge ? <NavCount count={count} tone={item.badge} /> : null}
                  <NavPending />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/**
 * The clicked destination, while its page is still being built.
 *
 * `useLinkStatus` reports the pending state of the enclosing `Link`, so the
 * feedback belongs to the item that was actually clicked rather than to a piece
 * of state that has to guess which one it was. It answers the first question a
 * click asks — *did that land?* — while `loading.tsx` answers the second, in
 * the body, about what is arriving. Without it a slow route left the reader
 * looking at the old page with no mark anywhere on the screen.
 *
 * The mark is the same 2px rule the active state uses, drawn in a dimmed accent
 * and travelling: the destination is adopting the marker the current page still
 * holds. Nothing moves in the layout, so the rail cannot reflow under a thumb
 * mid-tap.
 */
function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute inset-x-2 -bottom-px h-[2px] animate-pulse bg-accent/55"
    />
  );
}

/**
 * Zero renders as a hairline dash, not as "0". A queue at zero is the good
 * state and should look quiet; a numeral there competes with the one queue that
 * actually has work in it.
 */
function NavCount({ count, tone }: { count: number; tone: "intake" | "leads" }) {
  if (count === 0) {
    return (
      <span aria-hidden="true" className="text-[11px] leading-none text-ink/25">
        —
      </span>
    );
  }

  return (
    <span
      className={cx(
        "min-w-[18px] rounded-full px-[5px] py-[2px] text-center text-[11px] font-medium leading-[1.3] tabular-nums",
        // Intake is the only queue where an item sitting untouched is a
        // problem, so it is the only one that gets the accent.
        tone === "intake"
          ? "bg-accent/16 text-accent-300"
          : "bg-ink/10 text-ink/65",
      )}
    >
      {count}
      <span className="sr-only"> waiting</span>
    </span>
  );
}
