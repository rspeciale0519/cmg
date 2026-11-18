import { z } from "zod";
import { LEGAL_MILESTONES, LEGAL_RETURN_STATUSES, LEGAL_SUMMARY_FIELDS, type LegalMilestone } from "./types";

const uuid = z.string().uuid();
const actualDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid date.");
export const firmSchema = z.object({
  firmId: z.union([uuid, z.literal("")]),
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().min(1).max(160),
  contactEmail: z.email().max(254),
  contactPhone: z.string().trim().min(1).max(60),
  isActive: z.boolean(),
});
export const startSchema = z.object({ claimId: uuid, firmId: uuid, requestId: uuid });
export const milestoneSchema = z.object({
  handoffId: uuid, requestId: uuid,
  expectedVersion: z.coerce.number().int().min(1),
  milestone: z.enum(LEGAL_MILESTONES), occurredOn: actualDate,
  returnStatus: z.union([z.enum(LEGAL_RETURN_STATUSES), z.literal("")]),
}).superRefine((value, context) => {
  const returning = value.milestone === "declined" || value.milestone === "returned";
  if (returning !== (value.returnStatus !== "")) {
    context.addIssue({ code: "custom", path: ["returnStatus"], message: returning ? "Choose the current claim stage." : "A return stage applies only to a declined or returned claim." });
  }
});
export const packageSchema = z.object({
  handoffId: uuid, requestId: uuid,
  documentIds: z.array(uuid).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, "Select each document once."),
  summaryFields: z.array(z.enum(LEGAL_SUMMARY_FIELDS)).min(1).max(7).refine((fields) => new Set(fields).size === fields.length),
  summaryNote: z.string().trim().max(10000),
});
export function allowedMilestones(current: LegalMilestone | null): LegalMilestone[] {
  if (current === null) return ["sent"];
  if (current === "sent") return ["accepted", "declined", "returned"];
  if (current === "accepted") return ["lawsuit_filed", "returned"];
  if (current === "lawsuit_filed") return ["returned"];
  return [];
}
