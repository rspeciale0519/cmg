import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createInviteToken,
  hashInviteToken,
  INVITE_TTL_HOURS,
  inviteExpiryFrom,
  inviteUrl,
  isWellFormedInviteToken,
} from "@/lib/auth/invite-token";
import type { AppRole } from "@/lib/auth/roles";
import { dispatchOutbox } from "@/lib/email/outbox";
import type { InvitePayload } from "@/lib/email/templates/invite";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

export type InviteRow = {
  id: string;
  email: string;
  role: AppRole;
  claim_id: string | null;
  partner_company_id: string | null;
  expires_at: string;
  accepted_at: string | null;
};

export type IssueInviteInput = {
  email: string;
  role: AppRole;
  claimId?: string | null;
  partnerCompanyId?: string | null;
  /** `profiles.id` of the staff member issuing it — `invites.invited_by` is NOT NULL. */
  invitedBy: string;
  firstName?: string | null;
  claimRef?: string | null;
  companyName?: string | null;
  ip?: string | null;
};

export type IssueInviteResult =
  | {
      ok: true;
      inviteId: string;
      expiresAt: string;
      token: string;
      url: string;
      queued: boolean;
    }
  | { ok: false; reason: "acceptance_in_progress" | "insert_failed" };

function audienceFor(role: AppRole): InvitePayload["audience"] {
  if (role === "customer") return "customer";
  if (role === "partner") return "partner";
  return "staff";
}

/**
 * Service-role, per spec §3's list. It has to be: `invites_all_owner` scopes the
 * table to owners, and the flows that issue invites include an assigned
 * adjuster accepting an intake. Authorization for *who may issue what* is the
 * caller's job and lives in `src/lib/actions/invite.ts` — this function trusts
 * `invitedBy` and does not re-derive it.
 */
export async function issueInvite(
  input: IssueInviteInput,
): Promise<IssueInviteResult> {
  const email = input.email.trim().toLowerCase();
  const admin = createAdminClient();
  const { token, tokenHash } = createInviteToken();
  const expiresAt = inviteExpiryFrom();

  // Re-inviting supersedes an unreserved token rather than accumulating live
  // links. Once acceptance has reserved a token, the database refuses a resend
  // until that reservation expires so provisioning cannot finish against a
  // token the operator believed had been replaced.
  const url = inviteUrl(token);
  const payload: InvitePayload = {
    firstName: input.firstName?.trim() || "there",
    inviteUrl: url,
    audience: audienceFor(input.role),
    claimRef: input.claimRef ?? undefined,
    companyName: input.companyName ?? undefined,
    expiresInHours: INVITE_TTL_HOURS,
  };

  const { data, error } = await admin.rpc("issue_invite_transaction", {
    p_email: email,
    p_role: input.role,
    p_claim_id: input.claimId ?? null,
    p_partner_company_id: input.partnerCompanyId ?? null,
    p_invited_by: input.invitedBy,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
    p_payload: payload,
    p_ip: input.ip ?? null,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("[invite] atomic issuance failed", error?.message);
    return {
      ok: false,
      reason:
        error?.message === "invite acceptance is in progress"
          ? "acceptance_in_progress"
          : "insert_failed",
    };
  }
  const inviteId = typeof data.invite_id === "string" ? data.invite_id : null;
  const outboxId = typeof data.outbox_id === "string" ? data.outbox_id : null;
  const committedExpiry = typeof data.expires_at === "string" ? data.expires_at : null;
  if (!inviteId || !outboxId || !committedExpiry) return { ok: false, reason: "insert_failed" };
  await dispatchOutbox(admin, [outboxId]);

  return {
    ok: true,
    inviteId,
    expiresAt: committedExpiry,
    token,
    url,
    queued: true,
  };
}

/**
 * Looks an invite up by digest and returns it only when it is redeemable.
 *
 * The three failure modes — unknown token, already accepted, past its expiry —
 * collapse to a single `null` on purpose (spec §7.9). Distinguishing them tells
 * a stranger holding a guessed or stale token which guess was closer, and tells
 * anyone who intercepted an old link whether the recipient has used it yet.
 */
export async function findRedeemableInvite(
  admin: Admin,
  token: string,
): Promise<InviteRow | null> {
  if (!isWellFormedInviteToken(token)) return null;

  const { data, error } = await admin
    .from("invites")
    .select("id, email, role, claim_id, partner_company_id, expires_at, accepted_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  if (error || !data) return null;
  if (data.accepted_at !== null) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  return data as InviteRow;
}

/**
 * Single use, enforced as a compare-and-set rather than a read-then-write.
 * `.is("accepted_at", null)` is part of the UPDATE's own WHERE clause, so two
 * requests redeeming the same token race in Postgres and exactly one of them
 * gets a row back.
 *
 * Called BEFORE the account is created, which is the only ordering that is safe
 * in both directions: burn-then-create can waste an invite if account creation
 * fails, and that is recoverable by `restoreInvite()` below, whereas
 * create-then-burn can create a second account against an already-redeemed
 * invitation, which is not recoverable at all.
 */
export async function burnInvite(
  admin: Admin,
  inviteId: string,
  acceptedBy: string | null,
): Promise<boolean> {
  const { data, error } = await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: acceptedBy })
    .eq("id", inviteId)
    .is("accepted_at", null)
    .select("id");

  if (error) {
    console.error("[invite] burn failed", error.message);
    return false;
  }

  return (data?.length ?? 0) === 1;
}

/** Undoes `burnInvite` when the work it was guarding did not complete. */
export async function restoreInvite(admin: Admin, inviteId: string): Promise<void> {
  const { error } = await admin
    .from("invites")
    .update({ accepted_at: null, accepted_by: null })
    .eq("id", inviteId);

  if (error) {
    console.error("[invite] restore failed", error.message);
  }
}

export async function stampInviteAcceptedBy(
  admin: Admin,
  inviteId: string,
  userId: string,
): Promise<void> {
  const { error } = await admin
    .from("invites")
    .update({ accepted_by: userId })
    .eq("id", inviteId);

  if (error) {
    console.error("[invite] accepted_by stamp failed", error.message);
  }
}
