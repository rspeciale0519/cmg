import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireOpenPath } from "@/lib/authz";
import { site, telHref } from "@/lib/site";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

/**
 * One notice for every refused link — missing, malformed, unknown, expired or
 * already used. `/auth/confirm` and `/reset-password` both send here with it,
 * so the two cannot disagree about which failure they saw.
 */
const NOTICES: Record<string, string> = {
  "link-expired":
    "That reset link has expired or has already been used. Request a new one below.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  requireOpenPath("/forgot-password");
  const params = await searchParams;

  // `Object.hasOwn`, as on `/login`: a bare index would resolve
  // `?notice=toString` to a function and crash the render.
  const noticeKey = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const notice =
    noticeKey && Object.hasOwn(NOTICES, noticeKey) ? NOTICES[noticeKey] : undefined;

  return (
    <AuthShell
      kicker="Password reset"
      heading="Reset your password."
      intro={
        notice ? (
          <span className="text-ink/85">{notice}</span>
        ) : (
          "Enter the email address you sign in with. We will email you a link to choose a new password."
        )
      }
      footer={
        <>
          <Link href="/login" className="text-accent underline underline-offset-4">
            Back to sign in
          </Link>
          . Still stuck? Call{" "}
          <a href={telHref} className="text-accent underline underline-offset-4">
            {site.phone}
          </a>
          .
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
