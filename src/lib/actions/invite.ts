"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { hashInviteToken } from "@/lib/auth/invite-token";
import { isLeakedPassword } from "@/lib/auth/leaked-password";
import { landingPathFor } from "@/lib/auth/roles";
import { requireStaff } from "@/lib/authz";
import {
  burnInvite,
  findRedeemableInvite,
  issueInvite,
  restoreInvite,
  stampInviteAcceptedBy,
} from "@/lib/invites";
import {
  checkRateLimit,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { acceptInviteSchema } from "@/lib/validators/password";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  invalid,
  RATE_LIMIT_ERROR,
  type FormState,
  type InviteIssueState,
} from "./types";

/**
 * The single answer to every unusable invite: unknown, already redeemed,
 * expired, or malformed. Spec §7.9 — telling them apart hands a stranger a
 * probe for which tokens exist and tells whoever intercepted a forwarded link
 * whether the recipient has used it yet.
 */
const INVITE_GENERIC =
  "This invitation link is no longer usable. Ask CMG to send a new one — links expire after 72 hours and work only once.";

/**
 * Staff-initiated issuance for a claimant. Authorization is app-level because
 * the write is service-role: `invites_all_owner` scopes the table to owners,
 * while §6 has an assigned adjuster issuing invites when they accept an intake.
 * So the rule §4 states for the *claim* is applied here instead — owner, or the
 * adjuster the claim is assigned to. An assistant is staff and reaches this
 * action, and is refused: they hold no authority over the lifecycle.
 */
export async function issueClaimantInvite(
  _previous: InviteIssueState,
  formData: FormData,
): Promise<InviteIssueState> {
  const session = await requireStaff("/admin");
  const claimantId = String(formData.get("claimantId") ?? "").trim();

  const supabase = await createClient();
  const { data: claimant } = await supabase
    .from("claimants")
    .select(
      "id, first_name, last_name, email, claim_id, user_id, claims!inner(claim_ref, assigned_adjuster_id)",
    )
    .eq("id", claimantId)
    .maybeSingle();

  // One message covers "no such claimant", "a claimant on a claim you cannot
  // see" and "a claimant on a claim you may see but not manage". An assistant
  // can read every claimant row through `claimants_select`, so a distinct
  // "not authorised" here would confirm the row exists — the read boundary and
  // the write boundary are in different places and the error must not disclose
  // the gap between them.
  const claim = claimant?.claims;
  const canManage =
    claimant !== null &&
    claim !== undefined &&
    (session.role === "owner" ||
      (session.role === "adjuster" && claim.assigned_adjuster_id === session.userId));

  if (!claimant || !claim || !canManage) {
    return { status: "error", message: GENERIC_ERROR };
  }

  if (claimant.user_id) {
    return {
      status: "error",
      message: "That claimant already has portal access.",
    };
  }

  const ip = clientIpFromHeaders(await headers());
  const result = await issueInvite({
    email: claimant.email,
    role: "customer",
    claimId: claimant.claim_id,
    invitedBy: session.userId,
    firstName: claimant.first_name,
    claimRef: claim.claim_ref,
    ip: inetOrNull(ip),
  });

  if (!result.ok) {
    return { status: "error", message: GENERIC_ERROR };
  }

  /* With no RESEND_API_KEY the outbox row is queued and nothing is delivered —
     which is the configured state in local development. Returning the link to
     the staff member who just issued it is the honest behaviour in that case:
     the alternative is a UI that claims to have sent an email it demonstrably
     could not. It is withheld the moment delivery is actually configured, so in
     production the raw token continues to exist only in the recipient's inbox. */
  const deliverable = Boolean(process.env.RESEND_API_KEY);

  return {
    status: "success",
    message: deliverable
      ? `Invitation sent to ${claimant.email}. It expires in 72 hours.`
      : `Invitation created for ${claimant.email}. Email delivery is not configured on this environment, so hand them this link — it expires in 72 hours and works once.`,
    manualLink: deliverable ? undefined : result.url,
  };
}

type AcceptOutcome =
  | { kind: "signed_in"; destination: string }
  | { kind: "existing_account"; destination: string }
  | { kind: "failed"; state: FormState };

async function acceptInviteInner(formData: FormData): Promise<AcceptOutcome> {
  const token = String(formData.get("token") ?? "");
  const ip = clientIpFromHeaders(await headers());

  if (!(await checkRateLimit(RATE_LIMITS.inviteAcceptIp, ip))) {
    return { kind: "failed", state: { status: "error", message: RATE_LIMIT_ERROR } };
  }

  // Keyed on the digest, never the raw token: `rate_limits.key` is an ordinary
  // table row, and writing the redeemable secret into it would undo the whole
  // point of storing only a hash in `invites`.
  const tokenKey = token.length > 0 ? hashInviteToken(token) : "malformed";
  if (!(await checkRateLimit(RATE_LIMITS.inviteAcceptToken, tokenKey))) {
    return { kind: "failed", state: { status: "error", message: RATE_LIMIT_ERROR } };
  }

  const admin = createAdminClient();
  const invite = await findRedeemableInvite(admin, token);
  if (!invite) {
    return { kind: "failed", state: { status: "error", message: INVITE_GENERIC } };
  }

  const parsed = acceptInviteSchema(invite.email).safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });

  if (!parsed.success) {
    return { kind: "failed", state: invalid(fieldErrorsFrom(parsed.error)) };
  }

  const { firstName, lastName, password } = parsed.data;

  if (await isLeakedPassword(password)) {
    return {
      kind: "failed",
      state: invalid({
        password:
          "This password has appeared in a known data breach. Choose one you have not used elsewhere.",
      }),
    };
  }

  // Burn before creating. See `burnInvite` — this ordering can waste an
  // invitation, which `restoreInvite` undoes, while the other ordering can mint
  // a second account from one invitation, which nothing undoes.
  if (!(await burnInvite(admin, invite.id, null))) {
    return { kind: "failed", state: { status: "error", message: INVITE_GENERIC } };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (createError && createError.code !== "email_exists") {
    await restoreInvite(admin, invite.id);
    console.error("[invite] createUser failed", createError.message);
    return { kind: "failed", state: { status: "error", message: GENERIC_ERROR } };
  }

  let userId = created?.user?.id ?? null;

  if (!userId) {
    /* The address already has an account — a homeowner invited to a second
       claim, or a rep who already works with CMG. Holding the invite token does
       NOT entitle the holder to set a password on an account that already
       exists: that would turn any invitation into a takeover of whatever
       address it was addressed to. The invitation is still honoured — role and
       claim linkage are applied below — and the person signs in with the
       password they already have.

       `generateLink` is used only to resolve the user id; it returns the link
       rather than sending it, so no mail leaves the system here. */
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: invite.email,
    });
    userId = link?.user?.id ?? null;
  }

  if (!userId) {
    await restoreInvite(admin, invite.id);
    return { kind: "failed", state: { status: "error", message: GENERIC_ERROR } };
  }

  await stampInviteAcceptedBy(admin, invite.id, userId);

  // Role comes from the invite row and from nowhere else. It is never read from
  // the form, from user_metadata, or from anything else the invitee controls
  // (spec §4). `guard_profile_privileges()` refuses this write for any caller
  // that is not the service role or an active owner.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: invite.role,
      partner_company_id: invite.partner_company_id,
      first_name: firstName,
      last_name: lastName,
    })
    .eq("id", userId);

  if (profileError) {
    console.error("[invite] role assignment failed", profileError.message);
    await restoreInvite(admin, invite.id);
    return { kind: "failed", state: { status: "error", message: GENERIC_ERROR } };
  }

  if (invite.role === "customer" && invite.claim_id) {
    const { error: linkError } = await admin
      .from("claimants")
      .update({ user_id: userId })
      .eq("claim_id", invite.claim_id)
      .eq("email", invite.email);

    if (linkError) {
      console.error("[invite] claimant link failed", linkError.message);
      await restoreInvite(admin, invite.id);
      return { kind: "failed", state: { status: "error", message: GENERIC_ERROR } };
    }
  }

  await writeAudit(admin, {
    actorId: userId,
    action: "invite.accepted",
    entity: "invites",
    entityId: invite.id,
    meta: {
      email: invite.email,
      role: invite.role,
      claim_id: invite.claim_id,
      partner_company_id: invite.partner_company_id,
      account: created?.user ? "created" : "existing",
    },
    ip: inetOrNull(ip),
  });

  const destination = landingPathFor(invite.role);

  if (!created?.user) {
    return { kind: "existing_account", destination };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });

  if (signInError) {
    // The account exists and the password is set; only the session failed. Send
    // them to the login form rather than pretending the whole thing failed.
    return { kind: "existing_account", destination };
  }

  return { kind: "signed_in", destination };
}

export async function acceptInvite(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // `redirect()` throws to unwind, so it is kept out of the body above: a
  // `catch` anywhere in that flow would swallow NEXT_REDIRECT and turn a
  // successful acceptance into a generic error.
  const outcome = await acceptInviteInner(formData);

  if (outcome.kind === "failed") return outcome.state;

  if (outcome.kind === "existing_account") {
    redirect(
      `/login?next=${encodeURIComponent(outcome.destination)}&notice=invite-accepted`,
    );
  }

  redirect(outcome.destination);
}
