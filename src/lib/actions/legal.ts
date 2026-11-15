"use server";

import { revalidatePath } from "next/cache";
import { requireOwner, requireStaff } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { scheduleAirtableDelivery } from "@/lib/airtable/store";
import { firmSchema, startSchema, milestoneSchema, packageSchema } from "@/lib/legal/validation";
import { legalPackageSnapshotSchema } from "@/lib/legal/parse";
import { z } from "zod";
import type { LegalPackageState } from "@/lib/legal/types";
import { fieldErrorsFrom, submittedValues, type FormState } from "./types";

const REFUSED = "We could not save this legal handoff. Refresh the page and check your access and the current stage.";
function refreshLegal(claimId?: string) {
  revalidatePath("/admin", "layout");
  if (claimId) revalidatePath(`/portal/claims/${claimId}`, "layout");
}

export async function saveLawFirm(_previous: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const values = submittedValues(form, ["firmId", "name", "contactName", "contactEmail", "contactPhone", "isActive"]);
  values.isActive = form.get("isActive") === "on" ? "on" : "off";
  const parsed = firmSchema.safeParse({ ...values, firmId: values.firmId ?? "", isActive: form.get("isActive") === "on" });
  if (!parsed.success) return { status: "error", message: "Check the firm details.", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const p = parsed.data;
  const client = await createClient();
  const { error } = await client.rpc("save_law_firm", { p_firm_id: p.firmId || null, p_name: p.name, p_contact_name: p.contactName, p_contact_email: p.contactEmail, p_contact_phone: p.contactPhone, p_is_active: p.isActive });
  if (error) return { status: "error", message: REFUSED, values };
  refreshLegal();
  return { status: "success", message: "Law-firm details saved." };
}

export async function startLegalHandoff(_previous: FormState, form: FormData): Promise<FormState> {
  await requireStaff("/admin");
  const values = submittedValues(form, ["claimId", "firmId", "requestId"]);
  const parsed = startSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Choose an active law firm.", values };
  const p = parsed.data;
  const client = await createClient();
  const { error } = await client.rpc("start_legal_handoff", { p_claim_id: p.claimId, p_firm_id: p.firmId, p_request_id: p.requestId });
  if (error) return { status: "error", message: REFUSED, values };
  refreshLegal(p.claimId);
  scheduleAirtableDelivery(p.claimId);
  return { status: "success", message: "Handoff preparation started. No documents or emails were sent." };
}

export async function prepareLegalPackage(_previous: LegalPackageState, form: FormData): Promise<LegalPackageState> {
  await requireStaff("/admin");
  const values = submittedValues(form, ["handoffId", "requestId", "summaryNote"]);
  const parsed = packageSchema.safeParse({ ...values, documentIds: form.getAll("documentIds"), summaryFields: form.getAll("summaryFields") });
  if (!parsed.success) return { status: "error", message: "Choose documents and summary details. Check the summary text.", values };
  const p = parsed.data;
  const client = await createClient();
  const { data, error } = await client.rpc("prepare_legal_package", { p_handoff_id: p.handoffId, p_document_ids: p.documentIds, p_summary_fields: p.summaryFields, p_summary_note: p.summaryNote, p_request_id: p.requestId });
  if (error) return { status: "error", message: REFUSED, values };
  const result = legalPackageSnapshotSchema.safeParse(data);
  if (!result.success) return { status: "error", message: "The package was saved, but its details could not be displayed. Refresh before trying again.", values };
  refreshLegal(result.data.claimId);
  return { status: "success", message: "Review the summary and selected files before downloading. This does not send the handoff.", package: result.data };
}

export async function cancelLegalPreparation(_previous: FormState, form: FormData): Promise<FormState> {
  await requireStaff("/admin");
  const values = submittedValues(form, ["handoffId", "requestId", "expectedVersion"]);
  const parsed = z.object({ handoffId: z.uuid(), requestId: z.uuid(), expectedVersion: z.coerce.number().int().positive() }).safeParse(values);
  if (!parsed.success || form.get("confirmed") !== "on") return { status: "error", message: "Confirm cancellation of this unsent preparation.", values };
  const p = parsed.data;
  const client = await createClient();
  const { data, error } = await client.rpc("cancel_legal_preparation", { p_handoff_id: p.handoffId, p_expected_version: p.expectedVersion, p_request_id: p.requestId });
  if (error) return { status: "error", message: REFUSED, values };
  const result = z.object({ claimId: z.uuid() }).safeParse(data);
  if (!result.success) return { status: "error", message: "Cancellation was saved, but confirmation is unavailable. Refresh before trying again.", values };
  refreshLegal(result.data.claimId);
  scheduleAirtableDelivery(result.data.claimId);
  return { status: "success", message: "Unsent preparation cancelled. Its history and packages remain. No homeowner notice was sent." };
}

export async function recordLegalMilestone(_previous: FormState, form: FormData): Promise<FormState> {
  await requireStaff("/admin");
  const values = submittedValues(form, ["handoffId", "requestId", "expectedVersion", "milestone", "occurredOn", "returnStatus"]);
  const parsed = milestoneSchema.safeParse({ ...values, returnStatus: values.returnStatus ?? "" });
  if (!parsed.success) return { status: "error", message: "Check the milestone, date, and return stage.", fieldErrors: fieldErrorsFrom(parsed.error), values };
  if (form.get("confirmed") !== "on") return { status: "error", message: "Confirm that this milestone actually occurred.", values };
  const p = parsed.data;
  const client = await createClient();
  const { data, error } = await client.rpc("record_legal_milestone", { p_handoff_id: p.handoffId, p_expected_version: p.expectedVersion, p_milestone: p.milestone, p_occurred_on: p.occurredOn, p_return_status: p.returnStatus || null, p_request_id: p.requestId });
  if (error) return { status: "error", message: REFUSED, values };
  const result = z.object({ claimId: z.uuid() }).safeParse(data);
  if (!result.success) return { status: "error", message: "The milestone was saved, but confirmation is unavailable. Refresh before trying again.", values };
  refreshLegal(result.data.claimId);
  scheduleAirtableDelivery(result.data.claimId);
  return { status: "success", message: "Milestone saved. The homeowner notice is queued under the normal email rules." };
}
