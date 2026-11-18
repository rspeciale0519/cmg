import "server-only";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/authz";
import { loadClaimContext } from "@/lib/claims/queries";
import { createClient } from "@/lib/supabase/server";
import { connectionSchema, linkSchema, deliverySchema } from "./parse";
import { airtableEnabled } from "./config";

export async function loadCompanyAirtable(companyId: string) {
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) notFound();
  const client=await createClient();
  const [company, connection]=await Promise.all([
    client.from("partner_companies").select("id,name,status").eq("id",companyId).maybeSingle(),
    client.from("airtable_connections").select("*").eq("company_id",companyId).maybeSingle(),
  ]);
  if (company.error || connection.error) throw new Error("Airtable settings are unavailable.");
  if (!company.data) notFound();
  return { company:company.data, connection:connection.data ? connectionSchema.parse(connection.data) : null, available:airtableEnabled() };
}
export async function loadClaimSharing(claimId: string) {
  const context=await loadClaimContext(claimId);
  if (!context.can.canManage) notFound();
  const client=await createClient();
  const [connection,link,requests]=await Promise.all([
    context.claim.partnerCompanyId ? client.from("airtable_connections").select("*").eq("company_id",context.claim.partnerCompanyId).maybeSingle() : Promise.resolve({data:null,error:null}),
    client.from("airtable_claim_links").select("*").eq("claim_id",claimId).maybeSingle(),
    client.from("airtable_delivery_requests").select("id,digest,status,source_values,selected_fields,attempts,created_at,sent_at,last_error")
      .eq("claim_id",claimId).order("created_at",{ascending:false}).order("id").limit(30),
  ]);
  if (connection.error || link.error || requests.error) throw new Error("Sharing details are unavailable.");
  return { ...context, available:airtableEnabled(), connection:connection.data ? connectionSchema.parse(connection.data) : null,
    link:link.data ? linkSchema.parse(link.data) : null, requests:(requests.data ?? []).map(row=>deliverySchema.parse(row)) };
}
