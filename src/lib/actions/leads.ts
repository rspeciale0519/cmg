"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { writeAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/authz";
import { clientIpFromHeaders, inetOrNull } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database-app";
import { GENERIC_ERROR, type FormState } from "./types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const LEAD_STATUSES: readonly LeadStatus[] = [
  "new",
  "contacted",
  "converted",
  "dismissed",
] as const;

function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

/**
 * Moving a lead along. §4 puts leads in the owner-and-assistant row for writes
 * and gives adjusters read only, and `leads_update_staff` says exactly that —
 * so an adjuster reaches this action, reads the lead through `leads_select`,
 * and has their UPDATE return zero rows. That is not an error condition; it is
 * the policy working, and it is reported as a sentence rather than a fault.
 *
 * `leads` carries no audit trigger (spec §7.7 puts triggers on claims,
 * documents, status history, consents, financials and claimants), so the trail
 * entry here is written explicitly. It goes through the service-role client
 * because `audit_log` has no INSERT policy for `authenticated` at all — by
 * design, so that an append-only table cannot be appended to by a client.
 */
export async function updateLeadStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff("/admin");
  const leadId = String(formData.get("leadId") ?? "").trim();
  const requested = String(formData.get("status") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) {
    return { status: "error", message: "That enquiry is no longer available." };
  }

  if (!isLeadStatus(requested)) {
    return { status: "error", message: "That is not a lead status." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("leads")
    .select("id, name, status")
    .eq("id", leadId)
    .maybeSingle();

  if (!existing) {
    return { status: "error", message: "That enquiry is no longer available." };
  }

  // A save that changes nothing is not a save. Without this the action ran a
  // real UPDATE, wrote `leads.status_changed` with `from` equal to `to`, and
  // answered "marked contacted" — an entry in an append-only trail, and a
  // sentence claiming an event, for a status that never moved. `audit_log` is
  // the record of what happened; it must not carry things that did not.
  if (existing.status === requested) {
    return {
      status: "success",
      message: `${existing.name} is already ${requested}.`,
    };
  }

  const { data, error } = await supabase
    .from("leads")
    .update({ status: requested })
    .eq("id", leadId)
    .select("id");

  if (error) {
    console.error("[leads] status update failed", error.message);
    return { status: "error", message: GENERIC_ERROR };
  }

  if ((data?.length ?? 0) === 0) {
    return {
      status: "error",
      message: "Enquiries are worked by the owner and the assistant.",
    };
  }

  await writeAudit(createAdminClient(), {
    actorId: session.userId,
    action: "leads.status_changed",
    entity: "leads",
    entityId: leadId,
    meta: { from: existing.status, to: requested },
    ip: inetOrNull(clientIpFromHeaders(await headers())),
  });

  revalidatePath("/admin/leads");
  revalidatePath("/admin");

  return { status: "success", message: `${existing.name} marked ${requested}.` };
}
