import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Panel, PanelBody } from "@/components/admin/admin-shell";
import { AirtableLinkForm, AirtableMessageForm, AirtableReviewForm, AirtablePrepareForm } from "@/components/admin/airtable-claim-forms";
import { loadClaimSharing } from "@/lib/airtable/queries";
import { formatTimestamp } from "@/lib/format";
import { AirtablePauseForm } from "@/components/admin/airtable-pause-form";

export const dynamic="force-dynamic";
export const maxDuration=60;
export const metadata={title:"Company sharing"};
const STATUS={held:"Waiting for review",pending:"Waiting to send",sending:"Sending",uncertain:"Delivery result needs checking",sent:"Sent",review_required:"Needs attention",superseded:"Replaced by a newer update"};
export default async function ClaimSharingPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const {claim,can,connection,link,requests,available}=await loadClaimSharing(id);
  if(!claim.partnerCompanyId) return <Panel title="Company sharing"><PanelBody><p>This is a direct claim. It does not need an Airtable connection.</p></PanelBody></Panel>;
  return <div className="grid gap-4"><Panel title={`Sharing with ${claim.partnerName??"the referring company"}`}><PanelBody>
    {!available?<p className="mb-4 text-sm">Airtable delivery is paused until the approved service setup is complete.</p>:null}
    {link?<div className="mb-4"><AirtablePauseForm id={id} kind="claim" enabled={link.enabled}/></div>:null}
    {connection?.enabled && !connection.needs_reconnect ? <AirtableLinkForm key={`${connection.config_revision}-${link?.revision??0}`} claimId={id} connection={connection} link={link} available={available}/>:<p className="text-sm">The Owner must configure and enable this company’s connection first.</p>}
    {can.isOwner?<Link href={`/admin/partners/${claim.partnerCompanyId}/airtable`} className="mt-4 inline-block text-sm text-accent underline">Company connection settings</Link>:null}
  </PanelBody></Panel>
  {link?.enabled ? <><Panel title="Current update"><PanelBody><p className="mb-3 text-sm">Prepare a new review after correcting a failed update. Existing uncertain deliveries must be resolved first.</p><AirtablePrepareForm claimId={id} available={available}/></PanelBody></Panel>
    {(link.fields_override??connection?.default_fields??[]).includes("messages")?<Panel title="Shared message"><PanelBody><AirtableMessageForm claimId={id} requestId={randomUUID()} available={available}/></PanelBody></Panel>:null}</>:null}
  <Panel title="Recent delivery results"><PanelBody>{requests.length?<ol className="grid gap-5">{requests.map(request=><li key={request.id} className="min-w-0 border-b border-ink/10 pb-4"><p className="text-sm font-medium">{STATUS[request.status]}</p><p className="text-xs text-ink/60">{formatTimestamp(request.sent_at??request.created_at)} · {request.attempts} attempts</p>
    {["held","pending","uncertain"].includes(request.status)?<AirtableReviewForm claimId={id} request={request} available={available}/>:null}
    {request.status==="review_required"?<p className="mt-2 text-sm">Check access, the linked record, and the selected columns. Review current values after correcting the cause.</p>:null}
  </li>)}</ol>:<p className="text-sm">No updates are queued. Linking a record creates a first update for review.</p>}</PanelBody></Panel></div>;
}
