import type { ClaimStatus } from "@/lib/claims/status";
import type { FormState } from "@/lib/actions/types";

export const LEGAL_MILESTONES = ["sent", "accepted", "lawsuit_filed", "declined", "returned"] as const;
export type LegalMilestone = (typeof LEGAL_MILESTONES)[number];
export const LEGAL_RETURN_STATUSES = ["lor_signed", "documenting", "filed", "negotiating", "settlement_offered", "denied", "reopened"] as const;
export type LegalReturnStatus = (typeof LEGAL_RETURN_STATUSES)[number];
export const LEGAL_LABEL: Record<LegalMilestone, string> = {
  sent: "Sent to law firm", accepted: "Accepted by law firm", lawsuit_filed: "Lawsuit filed",
  declined: "Declined by law firm", returned: "Returned to CMG",
};
export const LEGAL_SUMMARY_FIELDS = ["claim", "homeowners", "property", "loss", "insurance", "adjuster", "settlement"] as const;
export type LegalSummaryField = (typeof LEGAL_SUMMARY_FIELDS)[number];
export type LegalFirm = {
  id: string; name: string; contact_name: string; contact_email: string;
  contact_phone: string; is_active: boolean;
};
export type LegalContact = { name: string; contactName: string; email: string; phone: string };
export type LegalSummaryEntry = { label: string; value: string };
export type LegalPackageDocument = {
  id: string; name: string; mime: string; sizeBytes: number; updatedAt: string;
};
/** No signed URLs or private storage paths belong in a persisted package. */
export type LegalPackageSnapshot = {
  id: string; claimId: string; handoffId: string; claimRef: string; createdAt: string;
  firm: LegalContact; summary: LegalSummaryEntry[]; summaryNote: string;
  documents: LegalPackageDocument[];
};
export type LegalHandoff = {
  id: string; claim_id: string; firm_id: string; firm_snapshot: LegalContact;
  milestone: LegalMilestone | null; prior_status: LegalReturnStatus;
  version: number; created_at: string; ended_at: string | null; outcome: string | null;
};
export type LegalMilestoneEntry = {
  id: string; handoff_id: string; milestone: LegalMilestone; occurred_on: string; recorded_at: string;
};
export type LegalProgress = {
  milestones: LegalMilestoneEntry[]; contact: LegalContact | null;
};
export type LegalMutationResult = {
  claimId: string; handoffId: string; milestoneId: string; claimStatus: ClaimStatus;
  version: number; duplicate: boolean;
};
export type LegalPackageState = FormState & { package?: LegalPackageSnapshot };
