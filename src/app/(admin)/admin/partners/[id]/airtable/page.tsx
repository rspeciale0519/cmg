import type { Metadata } from "next";
import { BackLink, PageHeader, Panel, PanelBody } from "@/components/admin/admin-shell";
import { AirtableCompanyForm } from "@/components/admin/airtable-company-form";
import { loadCompanyAirtable } from "@/lib/airtable/queries";
import { adminTitle, getSession, NOT_FOUND_TITLE } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
export const maxDuration=60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const refusal = { title: { absolute: adminTitle(NOT_FOUND_TITLE) } };
  if (!UUID.test(id)) return refusal;

  const session = await getSession();
  if (session?.role !== "owner" || session.aal !== "aal2") return refusal;

  const client = await createClient();
  const { data, error } = await client
    .from("partner_companies")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return refusal;
  return { title: "Airtable connection" };
}

export default async function AirtableSettingsPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const {company,connection,available}=await loadCompanyAirtable(id);
  return <div className="grid gap-4"><BackLink href={`/admin/partners/${id}`}>Back to company</BackLink>
    <PageHeader title={`${company.name} · Airtable`}/><Panel title="Company connection"><PanelBody>
      {company.status!=="active"?<p>This company’s connection stays paused while the company is inactive.</p>:<AirtableCompanyForm companyId={id} connection={connection} available={available}/>}
    </PanelBody></Panel></div>;
}
