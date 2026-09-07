"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";

export type ClaimTab = { href: string; label: string; count?: number };

/**
 * Tabs are routes, not state. Each one loads only its own data, so opening a
 * claim does not fetch its documents, its feed and its audit trail on the
 * chance the reader wants them — and a staff member can send a colleague a link
 * straight to the Activity tab of a specific file.
 *
 * Overview is matched exactly for the same reason the Dashboard nav item is:
 * every tab path starts with the claim root.
 */
export function ClaimTabs({ tabs, root }: { tabs: ClaimTab[]; root: string }) {
  const pathname = usePathname();
  const strip = useRef<HTMLDivElement>(null);

  // 534px of tabs in a 358px box on a phone. Opening at scrollLeft 0 left
  // Financials and History off the end, so on those two the strip showed four
  // tabs and marked none of them — and Financials, which holds the settlement
  // figures, was undiscoverable without a swipe nothing hinted at.
  useEffect(() => {
    strip.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <nav aria-label="Claim sections" className="border-b border-ink/10">
      {/* The strip sits on the page rather than inside a `Panel`, so the fade
          has to be painted in the page's own fill; the `--panel-fill` default is
          the panel composite and would show as a pale block over the canvas. */}
      <div
        ref={strip}
        className="scroll-x-edged [--panel-fill:var(--color-canvas)]"
      >
        <ul className="flex min-w-max items-stretch gap-1">
          {tabs.map((tab) => {
            const active = tab.href === root ? pathname === root : pathname === tab.href;

            return (
              <li key={tab.href} className="flex">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex items-center gap-[7px] whitespace-nowrap px-[11px] py-[11px] text-[13px] leading-[1.4] no-underline",
                    "transition-colors duration-150",
                    "after:absolute after:inset-x-[8px] after:-bottom-px after:h-[2px] after:content-['']",
                    active
                      ? "text-ink after:bg-accent"
                      : "text-ink/58 after:bg-transparent hover:text-ink/90 hover:after:bg-ink/20",
                  )}
                >
                  {tab.label}
                  {typeof tab.count === "number" && tab.count > 0 ? (
                    <span
                      className={cx(
                        /* Was `ink/45` active and `ink/30` inactive — 3.74:1
                           and 2.46:1 measured against the canvas, both under
                           the 4.5:1 an 11px numeral needs, and brightest on the
                           tab the reader is already standing on. These are the
                           numbers that decide which tab to open next, so the
                           three you are choosing between were the three you
                           could not read. Now 4.83:1 and 6.15:1. */
                        "text-[11px] leading-none tabular-nums",
                        active ? "text-ink/65" : "text-ink/55",
                      )}
                    >
                      {tab.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
