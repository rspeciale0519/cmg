import { BackLink, PageHeader, Panel, PanelBody } from "@/components/admin/admin-shell";
import { AirtableCompanyForm } from "@/components/admin/airtable-company-form";
import { loadCompanyAirtable } from "@/lib/airtable/queries";
export const dynamic="force-dynamic";
export const maxDuration=60;
export const metadata={title:"Airtable connection"};
export default async function AirtableSettingsPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const {company,connection,available}=await loadCompanyAirtable(id);
  return <div className="grid gap-4"><BackLink href={`/admin/partners/${id}`}>Back to company</BackLink>
    <PageHeader title={`${company.name} · Airtable`}/><Panel title="Company connection"><PanelBody>
      {company.status!=="active"?<p>This company’s connection stays paused while the company is inactive.</p>:<AirtableCompanyForm companyId={id} connection={connection} available={available}/>}
    </PanelBody></Panel></div>;
}
