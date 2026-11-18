"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner,requireStaff } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./types";
const input=z.object({id:z.uuid(),paused:z.enum(["true","false"])});
const refused:FormState={status:"error",message:"We could not change sharing. Refresh the page and check your access and the current connection."};
function result(paused:boolean):FormState {
  revalidatePath("/admin","layout");
  return {status:"success",message:paused
    ? "Sharing is paused. A request that already started can still finish."
    : "Sharing checks can resume. Old updates remain held. Review current values before sending."};
}
export async function setAirtableCompanyPaused(_previous:FormState,form:FormData):Promise<FormState> {
  await requireOwner();
  const parsed=input.safeParse({id:form.get("companyId"),paused:form.get("paused")});
  if(!parsed.success) return refused;
  const client=await createClient();
  const {error}=await client.rpc("set_airtable_company_paused",{p_company_id:parsed.data.id,p_paused:parsed.data.paused==="true"});
  return error ? refused : result(parsed.data.paused==="true");
}
export async function setAirtableClaimPaused(_previous:FormState,form:FormData):Promise<FormState> {
  await requireStaff("/admin");
  const parsed=input.safeParse({id:form.get("claimId"),paused:form.get("paused")});
  if(!parsed.success) return refused;
  const client=await createClient();
  const {error}=await client.rpc("set_airtable_claim_paused",{p_claim_id:parsed.data.id,p_paused:parsed.data.paused==="true"});
  return error ? refused : result(parsed.data.paused==="true");
}
