"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import { beginOAuth, accessToken } from "@/lib/airtable/oauth";
import { airtableConfig, airtableEnabled } from "@/lib/airtable/config";
import { AirtableClient, sameCells } from "@/lib/airtable/client";
import { loadCompanyAirtable, loadClaimSharing } from "@/lib/airtable/queries";
import { mappingSchema, providerId, validateMappings } from "@/lib/airtable/mapping";
import { shareFieldsSchema, modeSchema, cellsSchema } from "@/lib/airtable/parse";
import { sealSecret, openSecret } from "@/lib/airtable/crypto";
import { scheduleAirtableDelivery } from "@/lib/airtable/store";
import type { SetupState, RecordState } from "@/lib/airtable/action-state";
import type { AirtableFields } from "@/lib/airtable/fields";
import type { FormState } from "./types";

const FAILED="We could not complete this step. Refresh the page and check the connection and your access.";
const PAUSED="Airtable is paused. The Owner must finish the connection setup first.";
const fail=():FormState=>({status:"error",message:FAILED});
const uuid=(form:FormData,key:string)=>z.uuid().parse(form.get(key));
const revision=(form:FormData)=>z.coerce.number().int().nonnegative().parse(form.get("revision"));
function refresh(claimId?:string) { revalidatePath("/admin","layout"); if(claimId) scheduleAirtableDelivery(claimId); }

export async function connectAirtable(_previous:FormState,form:FormData):Promise<FormState> {
  const owner=await requireOwner();
  if(!airtableEnabled()) return {status:"error",message:PAUSED};
  let target:string;
  try { target=await beginOAuth(uuid(form,"companyId"),owner.userId); } catch { return fail(); }
  redirect(target);
}

export async function inspectAirtableSetup(_previous:SetupState,form:FormData):Promise<SetupState> {
  await requireOwner();
  if(!airtableEnabled()) return {status:"error",message:PAUSED};
  const companyId=z.uuid().safeParse(form.get("companyId"));
  if(!companyId.success) return fail();
  const {connection}=await loadCompanyAirtable(companyId.data);
  if(!connection || connection.needs_reconnect) return fail();
  try {
    const api=new AirtableClient(await accessToken(connection.id,companyId.data));
    const base=form.get("baseId"), table=form.get("tableId");
    if(typeof base!=="string" || !base) return {status:"success",message:"Choose the company's existing base.",bases:await api.bases()};
    providerId("app").parse(base);
    if(typeof table!=="string" || !table) return {status:"success",message:"Choose the existing table for its deals.",tables:await api.tables(base)};
    providerId("tbl").parse(table);
    return {status:"success",message:"Choose columns reserved for CMG. CMG will not create columns.",fields:await api.schema(base,table)};
  } catch { return fail(); }
}

export async function saveAirtableCompany(_previous:FormState,form:FormData):Promise<FormState> {
  await requireOwner();
  if(!airtableEnabled()) return {status:"error",message:PAUSED};
  const companyId=z.uuid().safeParse(form.get("companyId"));
  if(!companyId.success) return fail();
  const {connection}=await loadCompanyAirtable(companyId.data);
  if(!connection) return fail();
  try {
    const baseId=providerId("app").parse(form.get("baseId")),tableId=providerId("tbl").parse(form.get("tableId"));
    const fields=shareFieldsSchema.parse(form.getAll("fields")),mode=modeSchema.parse(form.get("mode"));
    const raw=mappingSchema.parse(JSON.parse(z.string().max(30000).parse(form.get("mappings"))));
    if(form.get("reserved")!=="on") return {status:"error",message:"Confirm that the selected columns are reserved for CMG."};
    const api=new AirtableClient(await accessToken(connection.id,companyId.data));
    const mappings=validateMappings(raw,await api.schema(baseId,tableId));
    const client=await createClient();
    const {error}=await client.rpc("configure_airtable_company",{p_company_id:companyId.data,p_expected_revision:revision(form),
      p_config:{baseId,tableId,fields,mode,mappings,enabled:form.get("enabled")==="on"}});
    if(error) return fail();
    refresh();
    return {status:"success",message:"Settings saved. Each claim must confirm its record and review the first update. Older updates stay paused."};
  } catch { return fail(); }
}

const proofSchema=z.object({claimId:z.uuid(),recordId:providerId("rec"),connectionId:z.uuid(),revision:z.number().int().positive().safe(),expires:z.number(),cells:cellsSchema});
export async function inspectAirtableRecord(_previous:RecordState,form:FormData):Promise<RecordState> {
  const claimId=z.uuid().safeParse(form.get("claimId"));
  if(!claimId.success) return fail();
  const {session,claim,connection}=await loadClaimSharing(claimId.data);
  if(!airtableEnabled() || !connection?.enabled || !connection.base_id || !connection.table_id) return {status:"error",message:PAUSED};
  try {
    const recordId=providerId("rec").parse(form.get("recordId"));
    const api=new AirtableClient(await accessToken(connection.id,connection.company_id));
    const mapping=validateMappings(connection.mappings,await api.schema(connection.base_id,connection.table_id));
    const raw=await api.readRecord(connection.base_id,connection.table_id,recordId,mapping.map(m=>m.fieldId));
    const cells:AirtableFields=cellsSchema.parse(Object.fromEntries(mapping.map(m=>[m.fieldId,raw[m.fieldId]??null])));
    const ref=mapping.find(m=>m.source==="claim_ref")!;
    if(cells[ref.fieldId] && cells[ref.fieldId]!==claim.claimRef) return {status:"error",message:"This record already belongs to a different CMG claim."};
    const proof=sealSecret(JSON.stringify({claimId:claim.id,recordId,connectionId:connection.id,revision:connection.config_revision,expires:Date.now()+10*60*1000,cells}),`record:${session.userId}`,airtableConfig().key);
    return {status:"success",message:"Review the existing CMG columns. Confirm that this is the correct customer's deal.",proof,recordId,cells};
  } catch { return fail(); }
}
export async function saveAirtableClaim(_previous:FormState,form:FormData):Promise<FormState> {
  const claimId=z.uuid().safeParse(form.get("claimId"));
  if(!claimId.success) return fail();
  const {session,connection,link}=await loadClaimSharing(claimId.data);
  if(!airtableEnabled() || !connection?.enabled || !connection.base_id || !connection.table_id) return {status:"error",message:PAUSED};
  try {
    if(form.get("confirmed")!=="on") return {status:"error",message:"Confirm the correct customer and the reserved CMG columns."};
    const proof=proofSchema.parse(JSON.parse(openSecret(z.string().max(150000).parse(form.get("proof")),`record:${session.userId}`,airtableConfig().key)));
    if(proof.claimId!==claimId.data || proof.connectionId!==connection.id || proof.revision!==connection.config_revision || proof.expires<Date.now()) return fail();
    const fields=shareFieldsSchema.parse(form.getAll("fields"));
    const mode=z.union([modeSchema,z.literal("")]).parse(form.get("mode"));
    const api=new AirtableClient(await accessToken(connection.id,connection.company_id));
    const actual=await api.readRecord(connection.base_id,connection.table_id,proof.recordId,Object.keys(proof.cells));
    if(!sameCells(proof.cells,actual)) return {status:"error",message:"The Airtable record changed. Check it again before linking."};
    const messages=connection.mappings.find(m=>m.source==="messages");
    if(messages && proof.cells[messages.fieldId] && (link?.record_id!==proof.recordId || link.last_values[messages.fieldId]!==proof.cells[messages.fieldId])) {
      return {status:"error",message:"The message column already contains other text. Choose an empty column reserved for CMG."};
    }
    const client=await createClient();
    const {error}=await client.rpc("configure_airtable_claim",{p_claim_id:claimId.data,p_expected_revision:revision(form),p_record_id:proof.recordId,
      p_override:{mode,fields,baseline:proof.cells,expectedConnectionId:proof.connectionId,expectedConfigRevision:proof.revision},p_enabled:form.get("enabled")==="on"});
    if(error) return fail();
    refresh();
    return {status:"success",message:"Record and sharing choices saved. Review the first update below before sending."};
  } catch { return fail(); }
}

export async function addAirtableMessage(_previous:FormState,form:FormData):Promise<FormState> {
  const claimId=z.uuid().safeParse(form.get("claimId"));
  if(!claimId.success) return fail();
  await loadClaimSharing(claimId.data);
  if(!airtableEnabled()) return {status:"error",message:PAUSED};
  try {
    if(form.get("confirmed")!=="on") return {status:"error",message:"Confirm that the company may read this message."};
    const client=await createClient();
    const {error}=await client.rpc("post_airtable_message",{p_claim_id:claimId.data,p_body:z.string().trim().min(1).max(4000).parse(form.get("body")),p_request_id:uuid(form,"requestId")});
    if(error) return fail();
    refresh(claimId.data);
    return {status:"success",message:"Message recorded. Its delivery follows this claim's sharing choices."};
  } catch { return fail(); }
}
export async function reviewAirtableUpdate(_previous:FormState,form:FormData):Promise<FormState> {
  const claimId=z.uuid().safeParse(form.get("claimId"));
  if(!claimId.success) return fail();
  const workspace=await loadClaimSharing(claimId.data);
  if(!airtableEnabled()) return {status:"error",message:PAUSED};
  try {
    const requestId=uuid(form,"requestId"),digest=z.string().regex(/^[a-f0-9]{64}$/).parse(form.get("digest"));
    if(!workspace.requests.some(r=>r.id===requestId&&r.digest===digest)) return fail();
    if(form.get("confirmed")!=="on") return {status:"error",message:"Confirm the values shown before sending or retrying."};
    const rpc=form.get("intent")==="retry" ? "retry_airtable_update" : "approve_airtable_update";
    const client=await createClient(); const {error}=await client.rpc(rpc,{p_request_id:requestId,p_digest:digest});
    if(error) return fail();
    refresh(claimId.data);
    return {status:"success",message:"The reviewed update is queued. Check its delivery result below."};
  } catch { return fail(); }
}
export async function prepareAirtableReview(_previous:FormState,form:FormData):Promise<FormState> {
  const claimId=z.uuid().safeParse(form.get("claimId"));
  if(!claimId.success) return fail();
  await loadClaimSharing(claimId.data);
  if(!airtableEnabled()) return {status:"error",message:PAUSED};
  const client=await createClient(); const {error}=await client.rpc("preview_airtable_update",{p_claim_id:claimId.data});
  if(error) return fail(); refresh();
  return {status:"success",message:"A current update is ready for review. No update was sent."};
}
