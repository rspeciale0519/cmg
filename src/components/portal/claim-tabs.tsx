"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

export type PortalTab = { href: string; label: string; count?: number };

/**
 * Tabs are routes, not state — the same decision the workspace made, for the
 * same reasons: each screen loads only its own data, and a URL for the Documents
 * tab of a specific claim is a link a homeowner can put in an email to their
 * contractor.
 *
 * Larger than the workspace's tab strip (14.5px on a 44px target against 13px on
 * 38px), because this is one screen someone reads on a phone rather than a strip
 * an adjuster lives in.
 *
 * Overview is matched exactly, because every other tab path starts with the
 * claim root and a prefix match would light Overview on all of them.
 */
export function ClaimTabs({ tabs, root }: { tabs: PortalTab[]; root: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Claim sections" className="border-b border-ink/10">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex min-w-max items-stretch gap-1">
          {tabs.map((tab) => {
            const active = tab.href === root ? pathname === root : pathname === tab.href;

            return (
              <li key={tab.href} className="flex">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex min-h-[44px] items-center gap-[7px] whitespace-nowrap px-[13px] text-[14.5px] leading-[1.4] no-underline",
                    "transition-colors duration-150",
                    "after:absolute after:inset-x-[10px] after:-bottom-px after:h-[2px] after:content-['']",
                    active
                      ? "text-ink after:bg-accent"
                      : "text-ink/55 after:bg-transparent hover:text-ink/88 hover:after:bg-ink/20",
                  )}
                >
                  {tab.label}
                  {typeof tab.count === "number" && tab.count > 0 ? (
                    <span
                      className={cx(
                        /* Same correction as the workspace strip: `ink/45` and
                           `ink/30` measure 3.74:1 and 2.46:1 on this canvas,
                           under the 4.5:1 a numeral this size needs. */
                        "text-[12px] leading-none tabular-nums",
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
