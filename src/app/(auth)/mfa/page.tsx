import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { landingPathFor, safeNextPath } from "@/lib/auth/roles";
import { requireUser } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { MfaPanel } from "./mfa-panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Two-step verification",
  robots: { index: false, follow: false },
};

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext);

  const session = await requireUser("/mfa");

  // Already at aal2 — this page has nothing left to ask. Without the guard,
  // `/mfa` is a dead end a staff member can navigate back into after verifying.
  if (session.aal === "aal2") redirect(next ?? landingPathFor(session.role));

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((factor) => factor.status === "verified") ?? null;

  return (
    <AuthShell
      kicker="Two-step verification"
      heading={verified ? "Enter your code." : "Set up two-step verification."}
      intro={
        verified
          ? "Your account is protected by an authenticator app."
          : "CMG staff accounts require a second factor. The admin area does not open until this is done."
      }
      footer="Lost your device? Call the office — an owner can reset your second factor after verifying who you are."
    >
      <MfaPanel verifiedFactorId={verified?.id ?? null} next={next} />
    </AuthShell>
  );
}
