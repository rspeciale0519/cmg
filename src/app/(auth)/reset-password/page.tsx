import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { getRecoverySession, RECOVERY_EXPIRED_PATH } from "@/lib/auth/recovery";
import { requireOpenPath } from "@/lib/authz";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  requireOpenPath("/reset-password");

  // No recovery session — none at all, an ordinary signed-in one, a stale one,
  // or one for an account this mode does not serve — reads as an expired link.
  const recovery = await getRecoverySession();
  if (!recovery) redirect(RECOVERY_EXPIRED_PATH);

  return (
    <AuthShell
      kicker="Password reset"
      heading="Choose a new password."
      intro={
        recovery.needsCode
          ? "Your account uses an authenticator app. Enter its current code, then choose a new password."
          : "Choose a new password for your account."
      }
      width="md"
      footer="After you save it, every device signed in to this account is signed out. Sign in again with the new password."
    >
      <ResetPasswordForm email={recovery.email} needsCode={recovery.needsCode} />
    </AuthShell>
  );
}
