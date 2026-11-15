import { z } from "zod";
import { isShareField } from "./fields";
import { mappingSchema } from "./mapping";

export const cellsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
export const shareFieldsSchema = z.array(z.string().refine(isShareField)).min(1).max(24)
  .refine(keys => keys.includes("claim_ref") && new Set(keys).size === keys.length);
export const modeSchema = z.enum(["automatic","manual","milestones"]);
export const connectionSchema = z.object({ id: z.uuid(), company_id: z.uuid(), base_id: z.string().nullable(), table_id: z.string().nullable(),
  mappings: z.union([mappingSchema,z.array(z.never()).length(0)]), default_fields: shareFieldsSchema, default_mode: modeSchema,
  enabled: z.boolean(), config_revision: z.number(), needs_reconnect: z.boolean() });
export const linkSchema = z.object({ claim_id: z.uuid(), connection_id: z.uuid(), record_id: z.string(), mode_override: modeSchema.nullable(),
  fields_override: shareFieldsSchema.nullable(), enabled: z.boolean(), revision: z.number(), last_values: cellsSchema });
export const deliverySchema = z.object({ id: z.uuid(), digest: z.string(), status: z.enum(["held","pending","sending","uncertain","sent","review_required","superseded"]),
  source_values: cellsSchema, selected_fields: shareFieldsSchema, attempts: z.number(), created_at: z.string(), sent_at: z.string().nullable(), last_error: z.string().nullable() });
export type ConnectionView = z.infer<typeof connectionSchema>;
export type LinkView = z.infer<typeof linkSchema>;
export type DeliveryView = z.infer<typeof deliverySchema>;
