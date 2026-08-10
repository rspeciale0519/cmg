import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/lib/actions/auth";
import type { AppRole } from "@/lib/auth/roles";
import { cx } from "@/lib/cx";
import { site } from "@/lib/site";
import { AdminNav, type NavCounts } from "./admin-nav";
import { navFor, ROLE_LABEL } from "./nav";

export type AdminIdentity = {
  name: string;
  role: AppRole;
};

/**
 * Two fixed bands — identity, then destinations — over a page that scrolls
 * under them. Neither is sticky: a claims table is read by scrolling, and a
 * sticky 100px of chrome on a 900px laptop viewport is 11% of the screen spent
 * on things the reader already knows.
 */
export function AdminShell({
  identity,
  counts,
  children,
}: {
  identity: AdminIdentity;
  counts: NavCounts;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex min-h-[60px] w-full max-w-[1440px] items-center gap-x-6 gap-y-3 px-[clamp(16px,3vw,40px)] py-3">
          <Link
            href="/admin"
            aria-label="CMG claims desk"
            className="flex items-center gap-[11px] text-inherit no-underline"
          >
            <Image
              src="/images/logo-cmg-mark.png"
              alt=""
              width={573}
              height={513}
              sizes="30px"
              priority
              className="h-[26px] w-auto"
            />
            <span className="text-[9px] uppercase leading-[1.55] tracking-[0.24em] text-accent">
              Claims desk
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-4">
            <span className="text-right text-[13px] leading-[1.35] text-ink/78">
              {identity.name}
              <span className="ml-2 text-[11px] uppercase tracking-[0.16em] text-ink/42">
                {ROLE_LABEL[identity.role]}
              </span>
            </span>
            <Link
              href="/"
              className="hidden text-[13px] leading-[1.4] text-ink/58 no-underline transition-colors duration-150 hover:text-ink/90 sm:inline"
            >
              {site.name.split(" ")[0]} site
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-[34px] rounded-md border border-ink/16 px-3 text-[13px] leading-[1.4] text-ink/78 transition-colors duration-150 hover:border-ink/32 hover:text-ink active:bg-ink/10"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <AdminNav items={navFor(identity.role)} counts={counts} />

      <main
        id="main"
        className="mx-auto w-full max-w-[1440px] px-[clamp(16px,3vw,40px)] pb-24 pt-[clamp(24px,3vw,36px)]"
      >
        {children}
      </main>
    </div>
  );
}

/**
 * The one heading pattern every workspace page uses. `eyebrow` carries the
 * count or the scope, `actions` the page-level control — so the reader's eye
 * lands on the same three positions on every route.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-[clamp(18px,2vw,26px)]",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-[9px] text-[11px] uppercase leading-[1.4] tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[clamp(22px,2.4vw,28px)] font-medium leading-[1.18] tracking-[-0.022em]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-[9px] max-w-[72ch] text-[14px] leading-[1.65] text-ink/62">
            {lede}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** A titled region inside a page. Hairline top rule, never a box. */
export function Panel({
  title,
  meta,
  actions,
  children,
  className,
}: {
  title?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("border border-ink/11 bg-surface/38", className)}>
      {title ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-ink/10 px-[clamp(14px,1.6vw,20px)] py-[13px]">
          <h2 className="text-[14px] font-medium leading-[1.3] tracking-[-0.01em]">
            {title}
          </h2>
          {meta ? (
            <span className="text-[12px] leading-[1.4] text-ink/50">{meta}</span>
          ) : null}
          {actions}
        </div>
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
    <div className={cx("px-[clamp(14px,1.6vw,20px)] py-[clamp(14px,1.6vw,18px)]", className)}>
      {children}
    </div>
  );
}

/**
 * An empty screen is an invitation to act, so it says what would put something
 * here rather than reporting that nothing is.
 */
export function EmptyState({
  headline,
  children,
}: {
  headline: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-[clamp(14px,1.6vw,20px)] py-[clamp(28px,4vw,44px)] text-center">
      <p className="text-[14px] leading-[1.5] text-ink/72">{headline}</p>
      {children ? (
        <p className="mx-auto mt-[7px] max-w-[52ch] text-[13px] leading-[1.6] text-ink/45">
          {children}
        </p>
      ) : null}
    </div>
  );
}
