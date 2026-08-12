import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/lib/actions/auth";
import { cx } from "@/lib/cx";
import { site, telHref } from "@/lib/site";

/**
 * The chrome every portal screen sits in.
 *
 * Its own component rather than `PortalShell`, which the partner surface uses:
 * that one takes a heading and an intro and renders a page, and the customer
 * portal is a small application with a claim in it — tabs, a claim switcher, and
 * screens that own their own headings. Sharing a shell across two surfaces with
 * different shapes is how one of them ends up with a prop nobody passes.
 *
 * The wordmark links to `/` rather than to `/portal`: someone in the portal who
 * wants the public site should get it, and `/portal` is a click away in the nav
 * anyway.
 */
export function PortalFrame({
  identity,
  children,
}: {
  identity: { name: string; email: string | null };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-ink/9 bg-canvas/88 backdrop-blur-[14px]">
        <div className="mx-auto flex min-h-[74px] w-full max-w-[1080px] flex-wrap items-center gap-x-7 gap-y-3 px-[clamp(20px,4vw,48px)] py-[13px]">
          <Link
            href="/"
            aria-label={`${site.name} — home`}
            className="flex items-center gap-[13px] text-inherit no-underline"
          >
            <Image
              src="/images/logo-cmg-mark.png"
              alt=""
              width={573}
              height={513}
              sizes="40px"
              priority
              className="h-9 w-auto"
            />
            <span className="text-[9px] uppercase leading-[1.55] tracking-[0.24em] text-accent">
              Client portal
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/portal/profile"
              className="min-h-11 rounded-md px-1 py-[10px] text-right text-[13px] leading-[1.4] text-ink/72 no-underline transition-colors duration-200 hover:text-ink"
            >
              {identity.name}
              <span className="block text-[11px] uppercase tracking-[0.16em] text-ink/40">
                Your account
              </span>
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-11 rounded-md border border-ink/16 px-4 text-sm leading-[1.55] text-ink transition-colors duration-200 hover:bg-ink/7 active:bg-ink/14"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto w-full max-w-[1080px] flex-1 px-[clamp(20px,4vw,48px)] py-[clamp(28px,4.5vh,52px)]"
      >
        {children}
      </main>

      {/* The one number a homeowner in trouble actually wants is a phone
          number, so it is in the furniture on every screen rather than on a
          contact page they have to find. */}
      <footer className="border-t border-ink/9">
        <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-baseline gap-x-8 gap-y-2 px-[clamp(20px,4vw,48px)] py-[24px] text-[13px] leading-[1.6] text-ink/45">
          <p>
            Questions we have not answered?{" "}
            <a
              href={telHref}
              className="text-accent no-underline transition-colors duration-200 hover:text-accent-300"
            >
              {site.phone}
            </a>
          </p>
          <p className="ml-auto">
            {site.name} · License #{site.license}
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * The heading block a portal screen opens with. The accent hairline and the
 * kicker are the same two marks every section of the marketing site opens with,
 * so a homeowner arriving from the public pages is in the same place.
 */
export function PortalHeading({
  kicker,
  title,
  intro,
  actions,
}: {
  kicker?: string;
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[clamp(24px,3.5vh,36px)]">
      <span aria-hidden="true" className="mb-[18px] block h-px w-10 bg-accent" />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {kicker ? (
            <p className="mb-[9px] text-[11px] uppercase leading-[1.5] tracking-[0.2em] text-accent-300">
              {kicker}
            </p>
          ) : null}
          <h1 className="text-[clamp(26px,3.2vw,38px)] font-medium leading-[1.15] tracking-[-0.025em]">
            {title}
          </h1>
          {intro ? (
            <div className="mt-[13px] max-w-[62ch] text-[15px] leading-[1.75] text-ink/72">
              {intro}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex-none">{actions}</div> : null}
      </div>
    </div>
  );
}

/**
 * The claim switcher. Rendered only when there is more than one claim — a row
 * of one pill labelled "your claims" is furniture that answers a question
 * nobody asked.
 *
 * Links rather than a `<select>` with an onChange: every destination is a real
 * URL that works without JavaScript, is bookmarkable, and announces itself to a
 * screen reader as the navigation it is.
 */
export function ClaimSwitcher({
  claims,
  currentId,
}: {
  claims: ReadonlyArray<{ id: string; claim_ref: string; property_city: string }>;
  currentId: string;
}) {
  if (claims.length < 2) return null;

  return (
    <nav aria-label="Your claims" className="mb-[18px]">
      <ul className="flex flex-wrap gap-[7px]">
        {claims.map((claim) => {
          const current = claim.id === currentId;
          return (
            <li key={claim.id}>
              <Link
                href={`/portal/claims/${claim.id}`}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-[38px] items-center gap-2 rounded-md border px-[13px] text-[13px] leading-[1.4] no-underline transition-colors duration-200",
                  current
                    ? "border-accent bg-accent/14 text-accent"
                    : "border-ink/14 text-ink/62 hover:border-ink/32 hover:text-ink",
                )}
              >
                <span className="tabular-nums">{claim.claim_ref}</span>
                <span className={current ? "text-accent/62" : "text-ink/35"}>
                  {claim.property_city}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
