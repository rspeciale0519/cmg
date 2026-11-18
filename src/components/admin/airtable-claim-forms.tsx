"use client";
import { useActionState, useState } from "react";
import { inspectAirtableRecord, saveAirtableClaim, addAirtableMessage, reviewAirtableUpdate, prepareAirtableReview } from "@/lib/actions/airtable";
import { idleState } from "@/lib/actions/types";
import type { RecordState } from "@/lib/airtable/action-state";
import type { ConnectionView, LinkView, DeliveryView } from "@/lib/airtable/parse";
import { SHARE_FIELDS, SEND_MODES, isShareField } from "@/lib/airtable/fields";
import { ActionFeedback, AdminField, AdminInput, AdminSelect, AdminTextarea, SubmitButton } from "./form-controls";
import { retainFormInputs } from "./retain-form-inputs";
import { humanizeEnum } from "@/lib/format";

function displaySharedValue(key:string,value:string|number|boolean):string {
  return ["status","cause","legal_milestone"].includes(key) ? humanizeEnum(String(value)) : String(value);
}

export function AirtableLinkForm({claimId,connection,link,available}:{claimId:string;connection:ConnectionView;link:LinkView|null;available:boolean}) {
  const [record,inspect]=useActionState(inspectAirtableRecord,{status:"idle"} as RecordState);
  const [state,save]=useActionState(saveAirtableClaim,idleState);
  const selected=link?.fields_override??connection.default_fields;
  return <div className="grid gap-5 text-sm">
    <p>Use the existing record number from Airtable. CMG will check this company’s selected table before you confirm.</p>
    <form ref={retainFormInputs} action={inspect} className="grid gap-3"><input type="hidden" name="claimId" value={claimId}/>
      <AdminField name="recordId" label="Airtable record number" hint="Starts with rec. Copy it from the correct deal’s Airtable URL."><AdminInput name="recordId" defaultValue={record.recordId??link?.record_id??""} required pattern="rec[a-zA-Z0-9]{14,32}"/></AdminField>
      <div><SubmitButton disabled={!available} pendingLabel="Checking…">Check existing record</SubmitButton></div><ActionFeedback state={record}/>
    </form>
    {record.proof ? <form key={record.proof} ref={retainFormInputs} action={save} className="grid gap-4">
      <input type="hidden" name="claimId" value={claimId}/><input type="hidden" name="revision" value={link?.revision??0}/><input type="hidden" name="proof" value={record.proof}/>
      <div><h3 className="mb-2 font-medium">Existing CMG columns in {record.recordId}</h3><dl className="grid gap-2">{connection.mappings.map(m=><div key={m.source} className="min-w-0"><dt className="text-ink/60">{SHARE_FIELDS[m.source]}</dt><dd className="whitespace-pre-wrap break-words">{displaySharedValue(m.source,record.cells?.[m.fieldId]??"Empty")}</dd></div>)}</dl></div>
      <fieldset className="grid gap-2"><legend className="mb-2 font-medium">Information this company may receive</legend>{connection.mappings.map(m=><label key={m.source} className="flex items-start gap-2"><input type="checkbox" name="fields" value={m.source} defaultChecked={selected.includes(m.source)||m.source==="claim_ref"} required={m.source==="claim_ref"}/><span>{SHARE_FIELDS[m.source]}</span></label>)}</fieldset>
      <AdminField name="mode" label="Sending rule for this claim"><AdminSelect name="mode" defaultValue={link?.mode_override??""}><option value="">Use company default: {SEND_MODES[connection.default_mode]}</option>{Object.entries(SEND_MODES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AdminSelect></AdminField>
      <label className="flex items-start gap-2"><input type="checkbox" name="enabled" defaultChecked={link?.enabled??true}/><span>Allow sharing for this claim.</span></label>
      <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" required/><span>I checked that this is the correct customer’s deal. The selected columns are reserved for CMG.</span></label>
      <p className="text-ink/65">The first update always needs review. Saving this form does not send it.</p>
      <div><SubmitButton disabled={!available} pendingLabel="Saving…">Confirm record and sharing</SubmitButton></div><ActionFeedback state={state}/>
    </form>:null}
  </div>;
}

export function AirtableMessageForm({claimId,requestId,available}:{claimId:string;requestId:string;available:boolean}) {
  const [body,setBody]=useState("");
  const [confirmed,setConfirmed]=useState(false);
  const [state,action,pending]=useActionState(async(previous:typeof idleState,form:FormData)=>{
    const result=await addAirtableMessage(previous,form);
    if(result.status==="success") {setBody("");setConfirmed(false);}
    return result;
  },idleState);
  return <form ref={retainFormInputs} action={action} className="grid gap-3 text-sm"><input type="hidden" name="claimId" value={claimId}/><input type="hidden" name="requestId" value={requestId}/>
    <AdminField name="body" label="Message for the referring company" hint="Do not include private notes or file links."><AdminTextarea name="body" required maxLength={4000} value={body} onChange={event=>setBody(event.target.value)} disabled={pending}/></AdminField>
    <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} disabled={pending}/><span>This company may read this message. It becomes part of the dated message history.</span></label>
    <p className="text-ink/65">Automatic message sharing can send this text immediately. Other modes hold it for review.</p>
    <div><SubmitButton disabled={!available} pendingLabel="Recording…">Record shared message</SubmitButton></div><ActionFeedback state={state}/>
  </form>;
}

export function AirtableReviewForm({claimId,request,available}:{claimId:string;request:DeliveryView;available:boolean}) {
  const [state,action]=useActionState(reviewAirtableUpdate,idleState);
  const retry=["pending","uncertain"].includes(request.status);
  return <form action={action} className="mt-3 grid gap-3 text-sm"><input type="hidden" name="claimId" value={claimId}/><input type="hidden" name="requestId" value={request.id}/><input type="hidden" name="digest" value={request.digest}/><input type="hidden" name="intent" value={retry?"retry":"approve"}/>
    <dl className="grid gap-2">{request.selected_fields.map(key=><div key={key} className="min-w-0"><dt className="text-ink/60">{isShareField(key)?SHARE_FIELDS[key]:key}</dt><dd className="whitespace-pre-wrap break-words">{request.source_values[key]===null || request.source_values[key]===undefined || request.source_values[key]==="" ? "CLEAR this selected Airtable cell" : displaySharedValue(key,request.source_values[key])}</dd></div>)}</dl>
    <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" required/><span>I reviewed these values and any cells marked CLEAR.</span></label>
    {request.status==="uncertain"?<p>The last delivery result is unknown. CMG will check Airtable before it sends again.</p>:null}
    <div><SubmitButton disabled={!available} pendingLabel="Queueing…">{retry?"Check and retry this update":"Approve this update"}</SubmitButton></div><ActionFeedback state={state}/>
  </form>;
}
export function AirtablePrepareForm({claimId,available}:{claimId:string;available:boolean}) {
  const [state,action]=useActionState(prepareAirtableReview,idleState);
  return <form action={action}><input type="hidden" name="claimId" value={claimId}/><SubmitButton disabled={!available}>Prepare current values for review</SubmitButton><ActionFeedback state={state}/></form>;
}
