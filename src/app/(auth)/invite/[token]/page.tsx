import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { requireOpenPath } from "@/lib/authz";
import { findRedeemableInvite } from "@/lib/invites";
import { site, telHref } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accept your invitation",
  robots: { index: false, follow: false },
};

/**
 * The same wording the accept action returns, for the same reason: an unknown
 * token, a redeemed one and an expired one must be indistinguishable from
 * outside (spec §7.9). This page and the action have to agree, or the pair of
 * them leaks by difference — a link that renders a form but fails on submit
 * says "this token existed", and one refused on sight says it did not.
 */
const REFUSAL =
  "This invitation link is no longer usable. Ask CMG to send a new one — links expire after 72 hours and work only once.";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  requireOpenPath("/invite");
  const { token } = await params;

  // Service-role, per spec §3: the caller has no session at all, and
  // `invites_all_owner` scopes the table to owners. Nothing from the row
  // reaches the page except the invited address and the role's own copy.
  const admin = createAdminClient();
  const invite = await findRedeemableInvite(admin, token);

  if (!invite) {
    return (
      <AuthShell
        kicker="Invitation"
        heading="This link has expired."
        footer={
          <>
            Call{" "}
            <a href={telHref} className="text-accent underline underline-offset-4">
              {site.phone}
            </a>{" "}
            and we will send a fresh invitation.
          </>
        }
      >
        <p className="text-[15px] leading-[1.75] text-ink/78">{REFUSAL}</p>
      </AuthShell>
    );
  }

  const { data: claimant } = invite.claim_id
    ? await admin
        .from("claimants")
        .select("first_name, last_name")
        .eq("claim_id", invite.claim_id)
        .eq("email", invite.email)
        .maybeSingle()
    : { data: null };

  const audience =
    invite.role === "customer"
      ? "Follow your claim from start to finish — status, documents and a direct line to your adjuster."
      : invite.role === "partner"
        ? "Track the claims your company refers to CMG: status, milestone dates and the settlement once a claim settles."
        : "Set a password to activate your staff account. You will set up an authenticator app immediately afterwards.";

  return (
    <AuthShell
      kicker="Invitation"
      heading="Set your password."
      intro={audience}
      width="md"
      footer="This link works once. After you set a password, sign in with your email address and the password you chose."
    >
      <InviteForm
        token={token}
        email={invite.email}
        firstName={claimant?.first_name ?? ""}
        lastName={claimant?.last_name ?? ""}
      />
    </AuthShell>
  );
}
