import { z } from "zod";
import { isShareField, MILESTONE_FIELDS, compatibleFieldType, type AirtableCell, type AirtableFields, type AirtableMapping, type AirtableSendMode, type SchemaField, type ShareField, type SourceValues } from "./fields";

export const providerId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}[a-zA-Z0-9]{14,32}$`));
export const mappingSchema = z.array(z.object({
  source: z.string().refine(isShareField), fieldId: providerId("fld"),
  fieldType: z.enum(["singleLineText", "multilineText", "email", "phoneNumber", "date", "dateTime", "number", "currency", "singleSelect"]),
  choices: z.record(z.string().max(100), z.string().min(1).max(200)).optional(),
}).strict()).min(1).max(24);

export function validateMappings(input: unknown, schema: readonly SchemaField[]): AirtableMapping[] {
  const parsed = mappingSchema.parse(input) as AirtableMapping[];
  const fieldIds = new Set<string>(); const sources = new Set<string>();
  for (const mapping of parsed) {
    const field = schema.find(f => f.id === mapping.fieldId);
    if (!field || field.type !== mapping.fieldType || fieldIds.has(mapping.fieldId) || sources.has(mapping.source)) throw new Error("MAPPING_INVALID");
    if (!compatibleFieldType(mapping.source,mapping.fieldType)) throw new Error("MAPPING_INVALID");
    if (mapping.fieldType === "singleSelect") {
      if (!mapping.choices || Object.values(mapping.choices).some(value => !field.options?.choices?.some(c => c.name === value))) throw new Error("MAPPING_INVALID");
    }
    fieldIds.add(mapping.fieldId); sources.add(mapping.source);
  }
  if (!sources.has("claim_ref")) throw new Error("MAPPING_INVALID");
  return parsed;
}

export function mapFields(source: SourceValues, mappings: readonly AirtableMapping[], selected: readonly ShareField[], reviewed = false): AirtableFields {
  const result: AirtableFields = {};
  for (const key of selected) {
    const value = source[key];
    // Clearing a formerly sent value needs a reviewed operation, never a missing source value.
    if ((value === null || value === undefined || value === "") && !reviewed) continue;
    const mapping = mappings.find(m => m.source === key);
    if (!mapping) throw new Error("MAPPING_INVALID");
    if (value === null || value === undefined || value === "") { result[mapping.fieldId] = null; continue; }
    let cell: AirtableCell = value;
    if (mapping.fieldType === "singleSelect") {
      const choice = mapping.choices?.[String(value)];
      if (!choice) throw new Error("MAPPING_INVALID");
      cell = choice;
    } else if (["number", "currency"].includes(mapping.fieldType)) {
      if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("MAPPING_INVALID");
    } else if (typeof value !== "string") throw new Error("MAPPING_INVALID");
    if (mapping.fieldType === "date" || mapping.fieldType === "dateTime") {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) throw new Error("MAPPING_INVALID");
      const date=new Date(value);
      if (!Number.isFinite(date.getTime())) throw new Error("MAPPING_INVALID");
      cell=mapping.fieldType==="date" ? date.toISOString().slice(0,10) : date.toISOString();
    }
    if (typeof cell === "string" && cell.length > 90000) throw new Error("FIELD_TOO_LONG");
    result[mapping.fieldId] = cell;
  }
  return result;
}

export function selectAutomaticFields(mode: AirtableSendMode, selected: readonly ShareField[]): ShareField[] {
  if (mode === "manual") return [];
  return selected.filter(field => mode === "automatic" || MILESTONE_FIELDS.includes(field));
}
