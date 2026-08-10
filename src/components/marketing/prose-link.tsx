import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ProseLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export function ProseLink({ href, className, children }: ProseLinkProps) {
  return (
    <Link
      href={href}
      className={cx(
        "text-accent underline decoration-accent/40 underline-offset-[3px] transition-colors duration-200",
        "hover:text-accent-300 hover:decoration-accent-300/70",
        className,
      )}
    >
      {children}
    </Link>
  );
}
