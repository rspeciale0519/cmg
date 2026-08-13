"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

const ITEMS = [
  { href: "/partner", label: "Referred claims", exact: true },
  { href: "/partner/refer", label: "Refer a claim", exact: false },
  { href: "/partner/profile", label: "Company profile", exact: false },
] as const;

export function PartnerNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Partner portal" className="mb-[clamp(22px,3vh,32px)] border-b border-ink/10">
      <ul className="flex min-w-max gap-1 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href || pathname.startsWith("/partner/claims/")
            : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex min-h-11 items-center px-3 text-[14px] no-underline after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:content-['']",
                  active
                    ? "text-ink after:bg-accent"
                    : "text-ink/58 after:bg-transparent hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
