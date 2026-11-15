import type { FormState } from "@/lib/actions/types";
import type { SchemaField, AirtableFields } from "./fields";
export type SetupState = FormState & { bases?: {id:string;name:string}[]; tables?: {id:string;name:string}[]; fields?: SchemaField[] };
export type RecordState = FormState & { proof?:string; recordId?:string; values?:Record<string,string>; cells?:AirtableFields };
