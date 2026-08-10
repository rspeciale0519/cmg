import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { landingPathFor, safeNextPath } from "@/lib/auth/roles";
import { getSession } from "@/lib/authz";
import { site, telHref } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  "invite-accepted":
    "Your invitation is accepted. You already have an account with this address — sign in with your existing password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext);

  const session = await getSession();
  if (session) redirect(next ?? landingPathFor(session.role));

  const noticeKey = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const notice = noticeKey ? NOTICES[noticeKey] : undefined;

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
