import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/lib/site";

/**
 * The frame every unauthenticated auth screen sits in. Deliberately not
 * `SiteHeader` / `SiteFooter`: those carry the marketing nav and a "File a
 * claim" CTA, and a person part-way through setting a password has one job on
 * the screen. The lockup, the accent hairline and the surface card are the same
 * three marks the marketing pages open every section with, so it reads as the
 * same site with the furniture taken away.
 */
export function AuthShell({
  kicker,
  heading,
  intro,
  children,
  footer,
  width = "sm",
}: {
  kicker: string;
  heading: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md";
}) {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center px-[clamp(20px,4vw,56px)] py-[clamp(40px,7vh,88px)]"
    >
      <Link
        href="/"
        aria-label={`${site.name} — home`}
        className="flex flex-col items-center gap-[5px] text-inherit no-underline"
      >
        <Image
          src="/images/logo-cmg-mark.png"
          alt=""
          width={573}
          height={513}
          sizes="65px"
          priority
          className="h-[58px] w-auto"
        />
        <span className="whitespace-nowrap text-[9px] uppercase leading-[1.55] tracking-[0.24em] text-accent">
          Property Solutions
        </span>
      </Link>

      <div
        className={
          width === "md"
            ? "mt-[clamp(32px,5vh,56px)] w-full max-w-[560px]"
            : "mt-[clamp(32px,5vh,56px)] w-full max-w-[440px]"
        }
      >
        <span aria-hidden="true" className="mb-[22px] block h-px w-10 bg-accent" />
        <p className="text-[11px] uppercase leading-[1.55] tracking-[0.2em] text-accent-300">
          {kicker}
        </p>
        <h1 className="mt-[10px] text-[clamp(26px,3.4vw,34px)] font-medium leading-[1.15] tracking-[-0.025em]">
          {heading}
        </h1>
        {intro ? (
          <div className="mt-[14px] text-[15px] leading-[1.7] text-ink/72">{intro}</div>
        ) : null}

        <div className="mt-[28px] border border-ink/13 bg-surface/55 p-[clamp(24px,3vw,36px)]">
          {children}
        </div>

        {footer ? (
          <div className="mt-6 text-[13px] leading-[1.7] text-ink/55">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}
