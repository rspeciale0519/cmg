"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { writeAudit } from "@/lib/audit";
import { requireOwner } from "@/lib/authz";
import { issueInvite } from "@/lib/invites";
import { resendApiKey } from "@/lib/email/outbox";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import { isSurfaceOpen } from "@/lib/site-mode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { partnerCompanySchema, partnerRepInviteSchema } from "@/lib/validators/partners";
import {
  fieldErrorsFrom,
  GENERIC_ERROR,
  INVITE_SURFACE_PAUSED,
  invalid,
  submittedValues,
  type FormState,
  type InviteIssueState,
} from "./types";

/**
 * Partner companies are owner-only in every layer (spec §4). Each action here:
 *
 *   1. `requireOwner()` — owner *and* aal2, and that is `notFound()` for anyone
 *      else, not a 403, so an adjuster probing `/admin/partners` learns nothing
 *      about whether the surface exists. The factor check is stated here rather
 *      than left to `proxy.ts` because `invitePartnerRep` reaches
 *      `issueInvite`, which writes as the service role and so is not covered by
 *      the database's own aal2 gate.
 *   2. writes through the *caller's* client, so
 *      `partner_companies_insert_owner` / `_update_owner` / `_delete_owner` are
 *      what actually permit the write. The role check above turns a refusal into
 *      a sentence; it is not the boundary.
 *   3. writes an audit row. `partner_companies` carries no audit trigger — the
 *      triggers in §7.7 cover claim-shaped tables — so every mutation on this
 *      surface is logged here explicitly or it is not logged at all.
 *
 * The service-role client appears exactly once, in `invitePartnerRep`, and only
 * to reach `writeAudit`: `audit_log` has no INSERT policy for `authenticated` by
 * design, so an application-level audit entry has no other path. It never
 * touches `partner_companies`.
 */

const NOT_FOUND =
  "That company is not available, or it no longer exists.";

const REFUSED =
  "Partner companies are managed by the owner. Ask them to make this change.";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidatePartners(companyId?: string) {
  revalidatePath("/admin/partners");
  if (companyId) revalidatePath(`/admin/partners/${companyId}`);
  revalidatePath("/admin/claims");
}

/**
 * The fields `PartnerCompanyForm` re-seeds from `FormState.values`. Every
 * refusal in this file returns them, so React's post-action reset lands on what
 * was typed rather than on an empty create form or — worse on the edit form —
 * on the stored values, which put a *valid* address back into a field still
 * wearing the invalid border and message, and threw away two unrelated edits
 * made in the same pass.
 */
const COMPANY_FIELDS = [
  "name",
  "contactName",
  "contactEmail",
  "contactPhone",
  "defaultFeePercent",
  "notes",
] as const;

const REP_INVITE_FIELDS = ["email", "firstName"] as const;

function readCompanyForm(formData: FormData) {
  return partnerCompanySchema.safeParse({
    name: formData.get("name") ?? "",
    contactName: formData.get("contactName") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    defaultFeePercent: formData.get("defaultFeePercent") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

async function auditPartner(
  actorId: string,
  action: string,
  companyId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  await writeAudit(createAdminClient(), {
    actorId,
    action,
    entity: "partner_companies",
    entityId: companyId,
    meta,
    ip: inetOrNull(clientIpFromHeaders(await headers())),
  });
}

export async function createPartnerCompany(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const typed = submittedValues(formData, COMPANY_FIELDS);

  const parsed = readCompanyForm(formData);
  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error), typed);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_companies")
    .insert({
      name: parsed.data.name,
      contact_name: parsed.data.contactName ?? null,
      contact_email: parsed.data.contactEmail ?? null,
      contact_phone: parsed.data.contactPhone ?? null,
      default_fee_percent: parsed.data.defaultFeePercent,
      notes: parsed.data.notes ?? null,
    })
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error("[partners] insert failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  // A policy declining an INSERT returns no row rather than an error.
  if (!data) return { status: "error", message: REFUSED, values: typed };

  await auditPartner(session.userId, "partner_company.created", data.id, {
    name: data.name,
    default_fee_percent: parsed.data.defaultFeePercent,
  });

  revalidatePartners(data.id);
  redirect(`/admin/partners/${data.id}`);
}

export async function updatePartnerCompany(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const companyId = String(formData.get("companyId") ?? "").trim();
  const typed = submittedValues(formData, COMPANY_FIELDS);
  if (!UUID.test(companyId)) {
    return { status: "error", message: NOT_FOUND, values: typed };
  }

  const parsed = readCompanyForm(formData);
  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error), typed);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_companies")
    .update({
      name: parsed.data.name,
      contact_name: parsed.data.contactName ?? null,
      contact_email: parsed.data.contactEmail ?? null,
      contact_phone: parsed.data.contactPhone ?? null,
      default_fee_percent: parsed.data.defaultFeePercent,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", companyId)
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error("[partners] update failed", error.message);
    return { status: "error", message: GENERIC_ERROR, values: typed };
  }

  if (!data) return { status: "error", message: NOT_FOUND, values: typed };

  // The fee is a money term, so every change to it is on the record with the
  // owner who made it — `partner_companies` carries no audit trigger.
  await auditPartner(session.userId, "partner_company.updated", companyId, {
    name: data.name,
    default_fee_percent: parsed.data.defaultFeePercent,
  });

  revalidatePartners(companyId);
  return { status: "success", message: `${data.name} saved.` };
}

/**
 * The designed way to end a relationship. `status = 'inactive'` is not a label:
 * `private.current_partner_company_id()` joins through `partner_companies` and
 * requires `pc.status = 'active'`, so every rep of an inactive company stops
 * matching `claim_partner_summaries_select` on their next request. The claims
 * they referred keep their attribution, which is what an audit trail needs.
 */
export async function setPartnerCompanyStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const companyId = String(formData.get("companyId") ?? "").trim();
  const requested = String(formData.get("status") ?? "").trim();

  if (!UUID.test(companyId)) return { status: "error", message: NOT_FOUND };
  if (requested !== "active" && requested !== "inactive") {
    return { status: "error", message: "A company is either active or inactive." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partner_companies")
    .update({ status: requested })
    .eq("id", companyId)
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error("[partners] status update failed", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  if (!data) return { status: "error", message: NOT_FOUND };

  await auditPartner(session.userId, "partner_company.status_changed", companyId, {
    name: data.name,
    status: requested,
  });

  revalidatePartners(companyId);

  return {
    status: "success",
    message:
      requested === "inactive"
        ? `${data.name} is now inactive. Their reps lose portal access on their next request; the claims they referred keep the attribution.`
        : `${data.name} is active again. Their reps can sign in.`,
  };
}

/**
 * Deletion is for a company that should never have existed. Anything else is
 * `status = 'inactive'`.
 *
 * `public.guard_partner_company_delete()` is a BEFORE DELETE trigger that counts
 * linked rep profiles and raises 23503 with a message naming the company, the
 * count, and what to do instead. That message is passed straight through rather
 * than replaced: it is the actionable one, it was written for this screen, and
 * substituting a generic sentence here would throw away the count. Postgres
 * error text is the one place a raw database string is the right thing to show —
 * so it is shown only for the code the guard raises, and every other failure
 * still becomes the generic message.
 */
export async function deletePartnerCompany(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireOwner();
  const companyId = String(formData.get("companyId") ?? "").trim();
  if (!UUID.test(companyId)) return { status: "error", message: NOT_FOUND };

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("partner_companies")
    .select("id, name")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) return { status: "error", message: NOT_FOUND };

  const { data, error } = await supabase
    .from("partner_companies")
    .delete()
    .eq("id", companyId)
    .select("id");

  if (error) {
    if (error.code === "23503") {
      return { status: "error", message: sentenceFrom(error.message) };
    }
    console.error("[partners] delete failed", error.message, error.code);
    return { status: "error", message: GENERIC_ERROR };
  }

  if ((data?.length ?? 0) === 0) return { status: "error", message: REFUSED };

  await auditPartner(session.userId, "partner_company.deleted", companyId, {
    name: company.name,
  });

  revalidatePartners();
  redirect("/admin/partners?deleted=1");
}

/**
 * The guard raises a lower-case sentence, as Postgres convention requires. It is
 * read by a person here, so it gets a capital and a full stop and nothing else —
 * no rewriting, because the useful part is the count the trigger computed.
 */
function sentenceFrom(message: string): string {
  const text = message.trim();
  const capitalised = text.charAt(0).toUpperCase() + text.slice(1);
  return capitalised.endsWith(".") ? capitalised : `${capitalised}.`;
}

/**
 * A rep invitation is an ordinary invite (spec §6) — role `partner`, tied to the
 * company, 72h single-use token, hashed at rest. `invites_all_owner` scopes the
 * table to owners; `issueInvite` writes as the service role because the same
 * helper serves the adjuster-accepts-an-intake path, so the authority to issue
 * *this* invitation is decided here, by `requireOwner()` — which is also why
 * that helper has to check the factor as well as the role: nothing downstream
 * of this line will.
 */
export async function invitePartnerRep(
  _previous: InviteIssueState,
  formData: FormData,
): Promise<InviteIssueState> {
  const session = await requireOwner();

  /* Same `/invite/:token` link as `issueClaimantInvite`, and the same reason
     for a refusal state rather than a redirect: this runs from
     `/admin/partners/[id]`, and a stale form there must not bounce the owner
     off the page they are looking at. */
  if (!isSurfaceOpen("/invite")) {
    return { status: "error", message: INVITE_SURFACE_PAUSED };
  }

  const companyId = String(formData.get("companyId") ?? "").trim();
  const typed = submittedValues(formData, REP_INVITE_FIELDS);
  if (!UUID.test(companyId)) {
    return { status: "error", message: NOT_FOUND, values: typed };
  }

  const parsed = partnerRepInviteSchema.safeParse({
    email: formData.get("email") ?? "",
    firstName: formData.get("firstName") ?? "",
  });

  if (!parsed.success) return invalid(fieldErrorsFrom(parsed.error), typed);

  // Read through the caller's client so `partner_companies_select` confirms the
  // company, and so a uuid that names nothing gets the same answer as one the
  // caller may not have.
  const supabase = await createClient();
  const { data: company } = await supabase
    .from("partner_companies")
    .select("id, name, status")
    .eq("id", companyId)
    .maybeSingle();

  if (!company) return { status: "error", message: NOT_FOUND, values: typed };

  // An invitation into an inactive company would complete and then hand the rep
  // a portal that shows nothing: current_partner_company_id() requires the
  // company to be active. Refused with the reason rather than issued and
  // wasted.
  if (company.status !== "active") {
    return {
      status: "error",
      message: `${company.name} is inactive, so a new rep would sign in to an empty portal. Make the company active first.`,
      values: typed,
    };
  }

  const result = await issueInvite({
    email: parsed.data.email,
    role: "partner",
    partnerCompanyId: companyId,
    invitedBy: session.userId,
    firstName: parsed.data.firstName ?? null,
    companyName: company.name,
    ip: inetOrNull(clientIpFromHeaders(await headers())),
  });

  if (!result.ok) return { status: "error", message: GENERIC_ERROR, values: typed };

  revalidatePartners(companyId);

  /* Without RESEND_API_KEY nothing is delivered, so the link is handed back to
     the owner who just issued it — the same choice `issueClaimantInvite` makes,
     for the same reason: a UI that claims to have sent an email it could not
     send is worse than one that says so. Withheld the moment delivery works. */
  const deliverable = result.queued && Boolean(resendApiKey());

  return {
    status: "success",
    message: !result.queued
      ? `Invitation created for ${parsed.data.email}, but its email could not be queued. Send them this recovery link — it expires in 72 hours and works once.`
      : deliverable
        ? `Invitation queued for email delivery to ${parsed.data.email}. It expires in 72 hours.`
        : `Invitation created for ${parsed.data.email}. Email delivery is not configured on this environment, so send them this link — it expires in 72 hours and works once.`,
    manualLink: deliverable ? undefined : result.url,
  };
}
