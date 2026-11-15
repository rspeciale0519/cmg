import { z } from "zod";
import { LEGAL_MILESTONES, LEGAL_RETURN_STATUSES, type LegalPackageSnapshot } from "./types";

export const legalContactSchema = z.object({ name: z.string(), contactName: z.string(), email: z.string(), phone: z.string() });
export const legalPackageSnapshotSchema: z.ZodType<LegalPackageSnapshot> = z.object({
  id: z.uuid(), claimId: z.uuid(), handoffId: z.uuid(), claimRef: z.string(), createdAt: z.string(),
  firm: legalContactSchema, summary: z.array(z.object({ label: z.string(), value: z.string() })),
  summaryNote: z.string(), documents: z.array(z.object({
    id: z.uuid(), name: z.string(), mime: z.string(), sizeBytes: z.number().int().positive(), updatedAt: z.string(),
  })),
});
export const legalHandoffSchema = z.object({
  id: z.uuid(), claim_id: z.uuid(), firm_id: z.uuid(), firm_snapshot: legalContactSchema,
  milestone: z.enum(LEGAL_MILESTONES).nullable(), prior_status: z.enum(LEGAL_RETURN_STATUSES),
  version: z.number().int(), created_at: z.string(), ended_at: z.string().nullable(), outcome: z.string().nullable(),
});
export const legalMilestoneEntrySchema = z.object({
  id: z.uuid(), handoff_id: z.uuid(), milestone: z.enum(LEGAL_MILESTONES), occurred_on: z.string(), recorded_at: z.string(),
});
export const legalProgressSchema = z.object({
  contact: legalContactSchema.nullable(), milestones: z.array(legalMilestoneEntrySchema),
});
