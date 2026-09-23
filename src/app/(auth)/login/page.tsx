import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { landingPathFor, safeNextPath } from "@/lib/auth/roles";
import { getSession, requireOpenPath } from "@/lib/authz";
import { site, telHref } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  "invite-accepted":
    "Your invitation is accepted. You already have an account with this address — sign in with your existing password.",
  /* The invitation asked for one kind of access and the address already held
     another — a contractor with a partner login who has also filed a claim of
     his own, most often. His account is not rewritten to match the invitation,
     so what he needs to know is that nothing about his sign-in has changed and
     the new claim is attached to it. */
  "invite-linked":
    "Your invitation is accepted and attached to the account you already have. Nothing about your sign-in has changed — use your existing password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  requireOpenPath("/login");
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext);

  const session = await getSession();
  if (session) redirect(next ?? landingPathFor(session.role));

  /* `Object.hasOwn`, not a bare index — the same bug already fixed once in
     src/lib/claims/status.ts, reintroduced here when `invite-linked` extended
     the map without anyone revisiting the lookup.

     `NOTICES[noticeKey]` walks the prototype chain, so `?notice=toString`,
     `?notice=constructor` and `?notice=hasOwnProperty` each resolved to a
     *function*, which was then handed to JSX as a child. React refuses to render
     a function and throws, and this is an unauthenticated route: a hand-typed
     query string turned the sign-in page into a 500. Verified: `?notice=toString`
     returned 500 before this line changed and 200 after.

     Read once into a local rather than indexed twice, so the guard and the value
     cannot drift apart later. */
  const noticeKey = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const notice =
    noticeKey && Object.hasOwn(NOTICES, noticeKey) ? NOTICES[noticeKey] : undefined;

  return (
    <AuthShell
      kicker="Client & partner access"
      heading="Sign in to your claim."
      intro={
        notice ? (
          <span className="text-ink/85">{notice}</span>
        ) : (
          "Accounts are issued by invitation. If you filed a claim with us and have not had an invitation yet, we will send one when your claim is accepted."
        )
      }
      footer={
        <>
          Trouble signing in? Call{" "}
          <a href={telHref} className="text-accent underline underline-offset-4">
            {site.phone}
          </a>{" "}
          and we will sort it out with you.
        </>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
