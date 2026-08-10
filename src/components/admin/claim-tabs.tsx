"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
                    "relative flex items-center gap-[7px] whitespace-nowrap px-[11px] py-[11px] text-[13px] leading-[1.4] no-underline",
                    "transition-colors duration-150",
                    "after:absolute after:inset-x-[8px] after:-bottom-px after:h-[2px] after:content-['']",
                    active
                      ? "text-ink after:bg-accent"
                      : "text-ink/55 after:bg-transparent hover:text-ink/88 hover:after:bg-ink/20",
                  )}
                >
                  {tab.label}
                  {typeof tab.count === "number" && tab.count > 0 ? (
                    <span
                      className={cx(
                        "text-[11px] leading-none tabular-nums",
                        active ? "text-ink/45" : "text-ink/30",
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
