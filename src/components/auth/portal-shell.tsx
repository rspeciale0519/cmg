import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/lib/actions/auth";
import { site } from "@/lib/site";

/**
 * Chrome shared by the three logged-in surfaces. Deliberately thin — Phases 4–6
 * own the dashboards inside it — but it fixes the two things every one of those
 * pages will need to agree on: where the identity sits, and where sign-out
 * lives.
 *
 * The wordmark links to `/` rather than to the surface root: someone in a portal
 * who wants the public site should get it, and the surface root is already the
 * page they are on.
 */
export function PortalShell({
  surface,
  heading,
  intro,
  identity,
  children,
}: {
  surface: string;
  heading: string;
  intro?: ReactNode;
  identity: { name: string; role: string };
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink/9 bg-canvas/82 backdrop-blur-[14px]">
        <div className="mx-auto flex min-h-[76px] w-full max-w-[1360px] flex-wrap items-center gap-x-8 gap-y-3 px-[clamp(20px,4vw,56px)] py-4">
          <Link
            href="/"
            aria-label={`${site.name} — home`}
            className="flex items-center gap-[14px] text-inherit no-underline"
          >
            <Image
              src="/images/logo-cmg-mark.png"
              alt=""
              width={573}
              height={513}
              sizes="45px"
              priority
              className="h-10 w-auto"
            />
            <span className="text-[9px] uppercase leading-[1.55] tracking-[0.24em] text-accent">
              {surface}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-5">
            {/* Not `hidden … sm:block`. At 390 the whole partner header read
                "PARTNER PORTAL | Sign out" and the identity was in the DOM,
                reachable by no gesture — on the one surface where a contractor
                with two companies' logins most needs to know which one they are
                in. The customer portal's own header solves this at the same
                width without hiding anything; the row wraps instead. */}
            <span className="text-right text-[13px] leading-[1.5] text-ink/72">
              {identity.name}
              <span className="block text-[11px] uppercase tracking-[0.18em] text-ink/55">
                {identity.role}
              </span>
            </span>
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
        className="mx-auto w-full max-w-[1360px] px-[clamp(20px,4vw,56px)] py-[clamp(36px,6vh,72px)]"
      >
        <span aria-hidden="true" className="mb-[22px] block h-px w-10 bg-accent" />
        <h1 className="text-[clamp(28px,3.4vw,42px)] font-medium leading-[1.15] tracking-[-0.025em]">
          {heading}
        </h1>
        {intro ? (
          <div className="mt-[14px] max-w-[68ch] text-[15px] leading-[1.75] text-ink/72">
            {intro}
          </div>
        ) : null}

        <div className="mt-[clamp(28px,4vh,44px)]">{children}</div>
      </main>
    </div>
  );
}

export function PortalCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <article className="border border-ink/13 bg-surface/55 p-[clamp(20px,2.4vw,28px)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-[20px] font-medium leading-[1.25] tracking-[-0.02em]">
          {title}
        </h2>
        {meta ? (
          <span className="text-[11px] uppercase leading-[1.55] tracking-[0.18em] text-accent">
            {meta}
          </span>
        ) : null}
      </div>
      {children ? (
        <div className="mt-[14px] text-[15px] leading-[1.7] text-ink/72">{children}</div>
      ) : null}
    </article>
  );
}

export function PortalEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="border border-dashed border-ink/16 p-[clamp(20px,2.4vw,28px)] text-[15px] leading-[1.7] text-ink/55">
      {children}
    </p>
  );
}
