export const SHARE_FIELDS = {
  claim_ref: "CMG claim reference", status: "Claim stage", lor_signed_at: "Representation signed",
  filed_at: "Filed with insurer", denied_at: "Insurer denial date", settled_at: "Settlement date",
  homeowner_name: "Homeowner name", homeowner_email: "Homeowner email", homeowner_phone: "Homeowner phone",
  property_address: "Property address", carrier: "Insurance company", claim_number: "Insurer claim number",
  loss_date: "Loss date", cause: "Cause of loss", adjuster_name: "Assigned adjuster", adjuster_email: "Adjuster email",
  law_firm_name: "Accepted law firm", law_firm_email: "Law firm email", law_firm_phone: "Law firm phone",
  legal_milestone: "Legal milestone", legal_date: "Legal milestone date", settlement_amount: "Agreed settlement amount",
  messages: "CMG shared-message history",
} as const;
export type ShareField = keyof typeof SHARE_FIELDS;
export const SHARE_FIELD_KEYS = Object.keys(SHARE_FIELDS) as ShareField[];
export const MILESTONE_FIELDS: readonly ShareField[] = ["claim_ref", "status", "lor_signed_at", "filed_at", "denied_at", "settled_at", "legal_milestone", "legal_date"];
export type AirtableSendMode = "automatic" | "manual" | "milestones";
export const SEND_MODES: Record<AirtableSendMode, string> = {
  automatic: "Automatic selected updates", manual: "Review every update", milestones: "Automatic stages; review other information",
};
export type AirtableCell = string | number | boolean | null;
export type AirtableFields = Record<string, AirtableCell>;
export type SourceValues = Partial<Record<ShareField, AirtableCell>>;
export type FieldType = "singleLineText" | "multilineText" | "email" | "phoneNumber" | "date" | "dateTime" | "number" | "currency" | "singleSelect";
export type AirtableMapping = { source: ShareField; fieldId: string; fieldType: FieldType; choices?: Readonly<Record<string, string>> };
export type SchemaField = { id: string; name?: string; type: string; options?: { choices?: { name: string }[] } };
export function isShareField(value: string): value is ShareField { return Object.hasOwn(SHARE_FIELDS, value); }

/** The source meaning, not its current value, determines compatible columns. */
export function compatibleFieldType(source:ShareField,type:string):boolean {
  if(source==="claim_ref") return type==="singleLineText";
  if(source==="messages") return type==="multilineText";
  if(source==="settlement_amount") return type==="currency" || type==="number";
  if(type==="singleLineText" || type==="multilineText") return true;
  if(type==="email") return ["homeowner_email","adjuster_email","law_firm_email"].includes(source);
  if(type==="phoneNumber") return ["homeowner_phone","law_firm_phone"].includes(source);
  if(type==="date" || type==="dateTime") return ["lor_signed_at","filed_at","denied_at","settled_at","loss_date","legal_date"].includes(source);
  return type==="singleSelect" && ["status","cause","legal_milestone"].includes(source);
}
