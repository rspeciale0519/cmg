"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireRole } from "@/lib/authz";
import {
  checkRateLimit,
  clientIpFromHeaders,
  inetOrNull,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { dispatchOutbox, outboxRows, staffInbox } from "@/lib/email/outbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { submitClaimUnit } from "./submission-transactions";
import { verifyTurnstile } from "@/lib/turnstile";
import { CAUSE_OPTIONS, labelFor } from "@/lib/validators/intake";
import { REFERRAL_FIELDS, referralSchema } from "@/lib/validators/referral";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  invalid,
  RATE_LIMIT_ERROR,
  submittedValues,
  VERIFICATION_ERROR,
  type FormState,
} from "./types";

/**
 * The referring contractor's one write (spec §6): a `new_intake` claim, already
 * attributed to their company, for staff to complete on accept.
 *
 * It is the public intake's shape with a different actor, and the difference in
 * actor is the whole design. A homeowner filing on their own roof is the subject
 * of the record; a rep filing on somebody else's is a third party, so the two
 * questions this action has to answer are "which company may this person refer
 * for" and "what may a third party assert on the homeowner's behalf". The first
 * is answered in Postgres, the second is answered by leaving `consents` alone.
 *
 * Unlike every other partner read, the write cannot go through the caller's own
 * client: §4 gives a partner no policy on `claims` or `claimants` at all — not a
 * narrow one, none — so the caller's client would be refused. This is the same
 * position `submitIntake` is in with an anonymous visitor, and it takes the same
 * answer: an app-level authorization check, then the service role. The check is
 * `requireRole("partner")` plus `partner_referral_company()`, and the second
 * half is the load-bearing one — it is the database, under the caller's own
 * session, saying which company this person is currently a rep of.
 */

/**
 * One sentence for every way the caller turns out not to be an active rep of an
 * active company. `partner_referral_company()` answers nothing for a rep whose
 * company has been set inactive, for a deactivated account, and for a session
 * that is not a partner at all; the three are not told apart here because the
 * reader can do nothing different about them and the desk can explain.
 */
const NO_COMPANY =
  "We could not match your account to an active partner company, so this referral was not sent. Call us and we will take the details and sort the account out.";

export async function referClaim(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole("partner");
  /* Echoed on every refusal below. React 19 resets a form when its action
     *resolves*, not when it succeeds, so without this a refused referral comes
     back as twelve empty boxes under a message explaining what to fix. Absent
     on success, where the empty form is the correct outcome — the rep's next
     referral is a different homeowner. */
  const typed = submittedValues(formData, REFERRAL_FIELDS);

  /* The limiter runs before Turnstile, which is the opposite order to
     `submitIntake`. There the token is the only thing identifying the caller at
     all; here `requireRole` has already named them, so the cheap local gate can
     go first — and it then also bounds the outbound siteverify request, which a
     script hammering this endpoint would otherwise make this server issue once
     per attempt. */
  if (!(await checkRateLimit(RATE_LIMITS.partnerReferralUser, session.userId))) {
    return { status: "error", message: RATE_LIMIT_ERROR, values: typed };
  }

  const requestHeaders = await headers();
  const ip = inetOrNull(clientIpFromHeaders(requestHeaders));

  /* Kept, and spec §7.4 names it — "Turnstile server-verified on
     intake/contact/referral". A signed-in caller is not the same guarantee: a
     session says an account is being used, not that a person is using it, and a
     rep's password is the one credential in this product that reaches a
     claim-creating endpoint with no second factor (§7.2 puts TOTP on staff
     only). What this stops is a script running under a borrowed or shared
     contractor login filling the intake queue with files the desk then triages
     by hand. The rate limit above bounds that to ten an hour; the challenge is
     what makes it ten an hour *by hand*. */
  const turnstile = await verifyTurnstile(
    formData.get("cf-turnstile-response"),
    ip,
  );
  if (!turnstile.ok) {
    console.warn("[referral] turnstile rejected", { reason: turnstile.reason });
    return { status: "error", message: VERIFICATION_ERROR, values: typed };
  }

  const text = (name: string) => formData.get(name) ?? "";
  const parsed = referralSchema.safeParse({
    firstName: text("firstName"),
    lastName: text("lastName"),
    email: text("email"),
    phone: text("phone"),
    street: text("street"),
    street2: text("street2"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    lossDate: text("lossDate"),
    cause: text("cause"),
    description: text("description"),
    turnstileToken: text("cf-turnstile-response"),
  });

  if (!parsed.success) {
    return invalid(fieldErrorsFrom(parsed.error), typed);
  }

  const input = parsed.data;
  const supabase = await createClient();

  /* Through the caller's own client, so `auth.uid()` inside the function is this
     rep. `public.partner_referral_company()` delegates to
     `private.current_partner_company_id()`, which is joined to
     `partner_companies` — a company set inactive revokes its reps, and that rule
     has one definition rather than a copy here that could drift from it. */
  const [{ data: companies, error: companyError }, { data: profile }] =
    await Promise.all([
      supabase.rpc("partner_referral_company"),
      supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", session.userId)
        .maybeSingle(),
    ]);

  if (companyError) {
    console.error("[referral] company lookup failed", companyError.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  const company = companies?.[0];
  if (!company) {
    return { status: "error", message: NO_COMPANY, values: typed };
  }

  /* The referrer is the person submitting, never a form field: a rep cannot
     credit the referral to somebody else, and the desk's "Referred by" line has
     to name whoever CMG will actually call back. "Company — Rep" is the shape
     the seed and the intake queue's card already use. */
  const repName = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const referrerName = repName ? `${company.name} — ${repName}` : company.name;

  const admin = createAdminClient();

  /**
   * The homeowner. Marked primary because they are the only person on the file:
   * a rep is not asked about a second policyholder for the same reason they are
   * not asked about the policy.
   *
   * `initials` is NOT NULL and is a signature field — it is what the Letter of
   * Representation is initialled with — so it cannot be invented here either.
   * The first letter of each name is a derivation of what the rep did supply
   * rather than a new assertion, and staff correct it with the homeowner before
   * anything is sent for signature.
   */
  /**
   * **No `consents` row, and the absence is the decision.**
   *
   * The public intake writes two — one SMS, one email — carrying the checkbox
   * text verbatim, the submitter's own phone and email, their IP and the moment
   * they ticked it. That row is evidence that a named person agreed to be
   * contacted, and `public.guard_consent_immutable()` treats it as evidence: it
   * can be annotated with a withdrawal and never edited.
   *
   * The homeowner is not at this form. A contractor cannot agree on their behalf
   * to be texted, and a consent row minted from a rep's submission would be
   * evidence of nothing while looking exactly like evidence of something — the
   * worst of the three possible outcomes, because CMG's TCPA position would then
   * rest on it. So the referred homeowner has no SMS permission on file and gets
   * no marketing text until they give one themselves.
   *
   * Nothing downstream needs one. Accepting the intake emails the primary
   * claimant about their own claim and invites them to the portal, which is
   * transactional correspondence about a file they are the subject of — the
   * distinction `withdrawConsent` already states on the profile page ("messages
   * about the claim itself still reach you").
   */

  /**
   * Tell CMG. Nothing else does.
   *
   * The public intake alerts the staff inbox the moment it writes a claim; this
   * form wrote one and told nobody, so a referral's entire arrival signal was a
   * count on a queue somebody had to think to open. A contractor who refers a
   * homeowner has handed CMG a live claim and told the homeowner to expect a
   * call, and the delay before anyone noticed was however long until the next
   * time a person looked at the intake screen.
   *
   * Staff only. The homeowner is not written to, for the reason set out above
   * the missing `consents` row: they were not at this form, and CMG making the
   * first approach is the point.
   *
   * Enqueued after the audit row and reported as a warning rather than an error
   * — the referral is committed by now, and a rep who has just submitted a claim
   * must not be told it failed because a mail queue was unreachable.
   */
  const notificationRows = outboxRows([
    {
      recipientEmail: staffInbox(),
      message: {
        template: "referral_staff_alert",
        payload: {
          claimRef: "pending",
          companyName: company.name,
          referrerName,
          referrerEmail: session.email ?? undefined,
          homeownerName: `${input.firstName} ${input.lastName}`,
          homeownerEmail: input.email,
          homeownerPhone: input.phone,
          propertyAddress: [
            input.street,
            input.street2,
            `${input.city}, ${input.state} ${input.zip}`,
          ]
            .filter(Boolean)
            .join(", "),
          lossDate: input.lossDate,
          cause: labelFor(CAUSE_OPTIONS, input.cause),
          description: input.description,
        },
      },
    },
  ]);
  const claim = await submitClaimUnit(admin, {
    claim: {
      status: "new_intake",
      property_street: input.street,
      property_street2: input.street2 ?? null,
      property_city: input.city,
      property_state: input.state,
      property_zip: input.zip,
      loss_date: input.lossDate,
      loss_time: null,
      cause: input.cause,
      description: input.description,
      carrier: null,
      policy_number: null,
      carrier_tenure: null,
      referrer_name: referrerName,
      referrer_email: session.email,
    },
    claimants: [{
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      initials: `${input.firstName[0]}${input.lastName[0]}`.toUpperCase(),
      is_primary: true,
    }],
    consents: [],
    documents: [],
    outbox: notificationRows,
    partnerCompanyId: company.id,
    audit: {
      actor_id: session.userId,
      action: "claim.partner_referral",
      ip,
      meta: {
        partner_company_id: company.id,
        partner_company_name: company.name,
        referrer_email: session.email,
      },
    },
  });
  if (!claim?.id || !claim.claim_ref) {
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }
  await dispatchOutbox(admin, claim.outbox_ids);

  // The projection trigger has already written this claim's row into
  // `claim_partner_summaries`, so the rep's list shows it on the next render.
  revalidatePath("/partner");

  return {
    status: "success",
    message: "Referral received.",
    reference: claim.claim_ref,
  };
}
