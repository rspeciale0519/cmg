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
        {/* `flex-wrap`, which `gap-y-3` had been anticipating without it. At 390
            this row held the mark, the wordmark, the signed-in identity and Sign
            out on one line, and everything gave way at once: "CLAIMS DESK" broke
            across two lines and the identity read "Austin" / "Graham OWNER" — a
            break through the middle of a person's name, which is the one place a
            name must not break. Letting the row wrap moves the identity group to
            its own line instead, and the two `whitespace-nowrap` rules below say
            which units are indivisible when it does. */}
        <div className="mx-auto flex min-h-[60px] w-full max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-[clamp(16px,3vw,40px)] py-3">
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
            <span className="whitespace-nowrap text-[9px] uppercase leading-[1.55] tracking-[0.24em] text-accent">
              Claims desk
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-4">
            <span className="text-right text-[13px] leading-[1.35] text-ink/78">
              <span className="whitespace-nowrap">{identity.name}</span>
              <span className="ml-2 whitespace-nowrap text-[11px] uppercase tracking-[0.16em] text-ink/42">
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
 * The way back up, written once.
 *
 * The two detail screens had grown their own versions and disagreed on four
 * separate decisions — 12px against 12.5px, `ink/45` against `ink/50`,
 * `hover:text-ink` against `hover:text-accent`, and an `aria-hidden` arrow
 * against a literal one that read the link out as "← Partner companies". None
 * of those is a decision either page should be making.
 *
 * The arrow is decoration and is hidden from the accessible name; `min-h-[24px]`
 * is the WCAG 2.2 target floor, which the 15–16.8px text boxes were under, and
 * the negative top margin gives the added height back so the label still sits
 * on the same baseline it did.
 *
 * `ink/58` rather than either version's own colour: at 12px both were under AA
 * on this canvas — `ink/45` measured 3.74:1 and `ink/50` 4.29:1 — and settling
 * on one of two failing values would only have made the failure consistent.
 * 5.25:1.
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-mt-[4px] mb-[14px] inline-flex min-h-[24px] items-center gap-[6px] text-[12px] leading-[1.4] text-ink/58 no-underline transition-colors duration-150 hover:text-ink"
    >
      <span aria-hidden="true">←</span> {children}
    </Link>
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

/**
 * A titled region inside a page. Hairline top rule, never a box.
 *
 * `min-w-0` is load-bearing, not tidiness. A `Panel` is almost always a grid
 * item, and a grid item's default `min-width: auto` resolves to its content's
 * min-content width — which, for a panel containing a `DataTable`, is the
 * table's 860px floor. The item then refused to be narrower than 860px no
 * matter what track it sat in: on `/admin` at 390 the chain measured
 * `main` 390 → grid 358 → `section` 862, so the scroll container inside was
 * itself 860 wide and never scrolled, and `body { overflow-x: clip }` stopped
 * the viewport from making up the difference. 488px of the dashboard — the
 * Status and Updated columns, the "All claims" link, both "Send invite"
 * buttons — was rendered, painted, and unreachable by any gesture.
 *
 * The same cause was visible at 1440 as a 56px kink in the vertical spine:
 * two rows declaring the identical `lg:grid-cols-[3fr_2fr]` resolved to
 * 806/538 and 862/482, because only one of them held a table.
 */
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
    <section className={cx("min-w-0 border border-ink/11 bg-surface/38", className)}>
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
