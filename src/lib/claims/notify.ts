import "server-only";

import { dispatchOutbox, outboxRows, staffInbox, type OutboxEntry } from "@/lib/email/outbox";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every claim-driven notification, in one place.
 *
 * They share a shape that is easy to get subtly wrong in five files: read the
 * recipient through whichever client is allowed to see them, enqueue through the
 * service-role one (spec §4 — `notifications_outbox` grants nothing to
 * `authenticated`, so a user session cannot insert into it at all), and never let
 * either step fail the action that caused it. `record-transition.ts` established
 * the pattern and this module is it, generalised, so that "a homeowner asked a
 * question" and "a claim settled" cannot drift apart in how they handle a queue
 * that is down.
 *
 * Every function here returns a warning sentence or null, never throws, and is
 * called after the write it reports on has already committed.
 */

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function portalUrl(): string {
  return `${siteBase()}/portal`;
}

export function partnerPortalUrl(): string {
  return `${siteBase()}/partner`;
}

export function adminClaimUrl(claimId: string): string {
  return `${siteBase()}/admin/claims/${claimId}`;
}

/**
 * Insert the rows and attempt delivery. The insert is the guarantee; the
 * dispatch after it is an optimisation that does nothing at all when no Resend
 * key is configured, in which case the sweeper owns the rows.
 */
export async function enqueueNotifications(entries: OutboxEntry[]): Promise<boolean> {
  if (entries.length === 0) return true;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications_outbox")
    .insert(outboxRows(entries))
    .select("id");

  if (error) {
    console.error("[claims] outbox enqueue failed", error.message);
    return false;
  }

  if (data && data.length > 0) {
    await dispatchOutbox(
      admin,
      data.map((row) => row.id),
    );
  }

  return true;
}

/**
 * A homeowner posted a question on their claim feed.
 *
 * `askQuestion` answers them with "your adjuster will answer here, and we will
 * email you when they do". That sentence promises two emails — this one, which
 * makes sure a human is told the question exists, and `reply_posted`, which
 * closes the loop. Before this, the first half was a feed entry nobody was
 * paged about.
 *
 * Read through the service-role client because the facts the staff inbox needs
 * are ones the asker cannot see: `profiles_select_self_or_staff` stops a
 * customer reading the assigned adjuster's name, and the claim reference is on a
 * row they can read but the adjuster is not.
 */
export async function notifyStaffOfQuestion(input: {
  claimId: string;
  question: string;
}): Promise<string | null> {
  const admin = createAdminClient();

  const { data: claim } = await admin
    .from("claims")
    .select("claim_ref, assigned_adjuster_id")
    .eq("id", input.claimId)
    .maybeSingle();

  if (!claim) return null;

  const [{ data: claimant }, { data: adjuster }] = await Promise.all([
    admin
      .from("claimants")
      .select("first_name, last_name")
      .eq("claim_id", input.claimId)
      .eq("is_primary", true)
      .maybeSingle(),
    claim.assigned_adjuster_id
      ? admin
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", claim.assigned_adjuster_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const homeownerName = fullName(claimant) ?? "The homeowner";
  const assignedTo = fullName(adjuster);

  const ok = await enqueueNotifications([
    {
      recipientEmail: staffInbox(),
      message: {
        template: "question_staff_alert",
        payload: {
          claimRef: claim.claim_ref,
          homeownerName,
          question: input.question,
          assignedTo: assignedTo ?? undefined,
          claimUrl: adminClaimUrl(input.claimId),
        },
      },
    },
  ]);

  return ok ? null : "Your question was posted, but the alert to CMG could not be queued.";
}

/**
 * Staff posted a feed entry the homeowner can read.
 *
 * Fired for anything customer-visible rather than for `type = 'reply'` alone.
 * The composer makes visibility an explicit choice, and choosing `customer` or
 * `shared` *means* "the homeowner reads this" — a note they can see is new
 * information addressed to them whatever the type column happens to say, and a
 * homeowner who was told they would be emailed when someone wrote back does not
 * care which of two internal categories it landed in. Anything staff do not want
 * mailed goes to `internal`, which is the composer's default and is not
 * notified.
 */
export async function notifyCustomerOfReply(input: {
  claimId: string;
  body: string;
}): Promise<string | null> {
  const admin = createAdminClient();

  const { data: claim } = await admin
    .from("claims")
    .select("claim_ref")
    .eq("id", input.claimId)
    .maybeSingle();

  if (!claim) return null;

  const { data: claimant } = await admin
    .from("claimants")
    .select("first_name, email")
    .eq("claim_id", input.claimId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!claimant) return null;

  const ok = await enqueueNotifications([
    {
      recipientEmail: claimant.email,
      message: {
        template: "reply_posted",
        payload: {
          firstName: claimant.first_name,
          claimRef: claim.claim_ref,
          body: input.body,
          portalUrl: portalUrl(),
        },
      },
    },
  ]);

  return ok ? null : "The entry was posted, but the homeowner's notification could not be queued.";
}

/**
 * A milestone on a claim a partner referred.
 *
 * Addressed to `partner_companies.contact_email` — the company's inbox, not a
 * rep's login — because the referral belongs to the company and reps come and
 * go. A company with no contact email on file is silently skipped: there is
 * nobody to tell, and it is not a failure of the status change.
 *
 * Only ever called for the statuses `visibilityForStatus` calls `shared`, which
 * are the same milestones `claim_partner_summaries` carries dates for. A partner
 * is not told about the week-to-week of a negotiation.
 */
export async function notifyPartnerOfStatus(input: {
  claimId: string;
  claimRef: string;
  statusLabel: string;
}): Promise<string | null> {
  const admin = createAdminClient();

  const { data: claim } = await admin
    .from("claims")
    .select("partner_company_id")
    .eq("id", input.claimId)
    .maybeSingle();

  if (!claim?.partner_company_id) return null;

  const { data: company } = await admin
    .from("partner_companies")
    .select("name, contact_email, status")
    .eq("id", claim.partner_company_id)
    .maybeSingle();

  /* An inactive company has had its reps' portal access revoked through
     `private.current_partner_company_id()`. Mailing them progress on a claim
     they can no longer open would be an update they cannot act on, from a
     relationship that has ended. */
  if (!company?.contact_email || company.status !== "active") return null;

  const { data: claimant } = await admin
    .from("claimants")
    .select("first_name, last_name")
    .eq("claim_id", input.claimId)
    .eq("is_primary", true)
    .maybeSingle();

  const ok = await enqueueNotifications([
    {
      recipientEmail: company.contact_email,
      message: {
        template: "partner_status_update",
        payload: {
          companyName: company.name,
          claimRef: input.claimRef,
          homeownerName: fullName(claimant) ?? "The homeowner",
          statusLabel: input.statusLabel,
          partnerUrl: partnerPortalUrl(),
        },
      },
    },
  ]);

  return ok ? null : "The status changed, but the referring partner's notification could not be queued.";
}

/**
 * The settlement figure as the homeowner should read it, or null when none is
 * recorded. `claim_financials.settlement_amount` arrives from PostgREST as a
 * string because `numeric` does not survive a round trip through JSON numbers
 * intact, so it is parsed rather than assumed.
 */
export async function settlementAmountFor(claimId: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("claim_financials")
    .select("settlement_amount")
    .eq("claim_id", claimId)
    .maybeSingle();

  const raw = data?.settlement_amount;
  if (raw === null || raw === undefined) return null;

  const amount = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(amount)) return null;

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fullName(
  person: { first_name: string | null; last_name: string | null } | null,
): string | null {
  if (!person) return null;
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}
