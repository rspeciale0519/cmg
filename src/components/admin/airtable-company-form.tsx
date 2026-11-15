"use client";
import { useActionState, useState } from "react";
import { connectAirtable, inspectAirtableSetup, saveAirtableCompany } from "@/lib/actions/airtable";
import { idleState } from "@/lib/actions/types";
import type { SetupState } from "@/lib/airtable/action-state";
import type { ConnectionView } from "@/lib/airtable/parse";
import { SHARE_FIELDS, SHARE_FIELD_KEYS, SEND_MODES, compatibleFieldType, type ShareField } from "@/lib/airtable/fields";
import { STATUS_LABEL } from "@/lib/claims/status";
import { ActionFeedback, AdminField, AdminSelect, SubmitButton } from "./form-controls";
import { retainFormInputs } from "./retain-form-inputs";
import { AirtablePauseForm } from "./airtable-pause-form";

const CHOICES:Partial<Record<ShareField,Record<string,string>>>={
  status:STATUS_LABEL,
  legal_milestone:{sent:"Sent",accepted:"Accepted",lawsuit_filed:"Lawsuit filed",declined:"Declined",returned:"Returned"},
  cause:{wind:"Wind",hail:"Hail",wind_hail:"Wind and hail",hurricane:"Hurricane",water:"Water",fire_smoke:"Fire or smoke",flood:"Flood",mold:"Mold",other:"Other"},
};
export function AirtableCompanyForm({companyId,connection,available}:{companyId:string;connection:ConnectionView|null;available:boolean}) {
  const [connectState,connect]=useActionState(connectAirtable,idleState);
  const [bases,basesAction]=useActionState(inspectAirtableSetup,{status:"idle"} as SetupState);
  const [tables,tablesAction]=useActionState(inspectAirtableSetup,{status:"idle"} as SetupState);
  const [schema,schemaAction]=useActionState(inspectAirtableSetup,{status:"idle"} as SetupState);
  const [saved,save]=useActionState(saveAirtableCompany,idleState);
  const [base,setBase]=useState(connection?.base_id??"");
  const [table,setTable]=useState(connection?.table_id??"");
  const [fields,setFields]=useState<Record<string,string>>(Object.fromEntries(connection?.mappings.map(m=>[m.source,m.fieldId])??[]));
  const [choices,setChoices]=useState<Record<string,Record<string,string>>>(Object.fromEntries(connection?.mappings.map(m=>[m.source,{...m.choices}])??[]));
  const mappings=SHARE_FIELD_KEYS.flatMap(source=>{
    const field=schema.fields?.find(f=>f.id===fields[source]);
    return field ? [{source,fieldId:field.id,fieldType:field.type,...(field.type==="singleSelect"?{choices:choices[source]??{}}:{})}] : [];
  });
  // React resets completed actions even when they return a refusal. Keep the
  // visible controls and the canonical mapping state on the same reviewed values.
  return <div className="grid gap-6 text-sm">
    <p>CMG only updates the columns you select. Each claim needs its own confirmed record. Files and private notes stay in CMG.</p>
    {!available?<p role="status">Airtable is paused until the approved service setup is complete.</p>:null}
    {connection?.base_id && connection.table_id ? <AirtablePauseForm id={companyId} kind="company" enabled={connection.enabled}/>:null}
    <form action={connect}><input type="hidden" name="companyId" value={companyId}/><SubmitButton disabled={!available} pendingLabel="Opening Airtable…">{connection ? "Reconnect Airtable" : "Connect Airtable"}</SubmitButton><ActionFeedback state={connectState}/></form>
    {connection && !connection.needs_reconnect ? <>
      <form action={basesAction}><input type="hidden" name="companyId" value={companyId}/><SubmitButton disabled={!available}>Load available bases</SubmitButton><ActionFeedback state={bases}/></form>
      <form ref={retainFormInputs} action={tablesAction} className="grid gap-3"><input type="hidden" name="companyId" value={companyId}/>
        <AdminField name="baseId" label="Company's base"><AdminSelect name="baseId" value={base} onChange={event=>{setBase(event.target.value);setTable("");}} required>
          <option value="">Choose a base</option>{base && !bases.bases?.some(b=>b.id===base)?<option value={base}>{base}</option>:null}
          {bases.bases?.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</AdminSelect></AdminField>
        <div><SubmitButton disabled={!available || !base}>Load its tables</SubmitButton></div><ActionFeedback state={tables}/>
      </form>
      <form ref={retainFormInputs} action={schemaAction} className="grid gap-3"><input type="hidden" name="companyId" value={companyId}/><input type="hidden" name="baseId" value={base}/>
        <AdminField name="tableId" label="Existing deals table"><AdminSelect name="tableId" value={table} onChange={event=>setTable(event.target.value)} required>
          <option value="">Choose a table</option>{table && !tables.tables?.some(t=>t.id===table)?<option value={table}>{table}</option>:null}
          {tables.tables?.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</AdminSelect></AdminField>
        <div><SubmitButton disabled={!available || !base || !table}>Load its columns</SubmitButton></div><ActionFeedback state={schema}/>
      </form>
      {schema.fields ? <form ref={retainFormInputs} action={save} className="grid gap-5">
        <input type="hidden" name="companyId" value={companyId}/><input type="hidden" name="revision" value={connection.config_revision}/>
        <input type="hidden" name="baseId" value={base}/><input type="hidden" name="tableId" value={table}/><input type="hidden" name="mappings" value={JSON.stringify(mappings)}/>
        <fieldset className="grid gap-4"><legend className="mb-3 font-medium">Choose CMG columns and default sharing</legend>
          {SHARE_FIELD_KEYS.map(source=>{const field=schema.fields?.find(f=>f.id===fields[source]);return <div key={source} className="grid gap-2 border-b border-ink/10 pb-3">
            <AdminField name={`mapping-${source}`} label={SHARE_FIELDS[source]}><AdminSelect name={`mapping-${source}`} value={fields[source]??""} onChange={event=>setFields({...fields,[source]:event.target.value})} required={source==="claim_ref"}>
              <option value="">Do not make this information available</option>{schema.fields?.filter(f=>compatibleFieldType(source,f.type)).map(f=><option key={f.id} value={f.id}>{f.name} · {f.type}</option>)}</AdminSelect></AdminField>
            {field ? <label className="flex items-start gap-2"><input type="checkbox" name="fields" value={source} defaultChecked={connection.default_fields.includes(source) || source==="claim_ref"} required={source==="claim_ref"}/><span>Share by default</span></label>:null}
            {field?.type==="singleSelect" ? Object.entries(CHOICES[source]??{}).map(([value,label])=><AdminField key={value} name={`${source}-${value}`} label={`${label} becomes`}><AdminSelect name={`${source}-${value}`} value={choices[source]?.[value]??""} onChange={event=>setChoices({...choices,[source]:{...choices[source],[value]:event.target.value}})} required><option value="">Choose an existing option</option>{field.options?.choices?.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</AdminSelect></AdminField>):null}
          </div>;})}
        </fieldset>
        <AdminField name="mode" label="Default sending rule"><AdminSelect name="mode" defaultValue={connection.default_mode}>{Object.entries(SEND_MODES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AdminSelect></AdminField>
        <label className="flex items-start gap-2"><input type="checkbox" name="reserved" required/><span>These columns belong to CMG. Other tools and people will not change their contents.</span></label>
        <label className="flex items-start gap-2"><input type="checkbox" name="enabled" defaultChecked={connection.enabled}/><span>Allow claim staff to link records after this review.</span></label>
        <p className="text-ink/65">Saving pauses existing claim links. Staff must confirm each link again. Older held updates do not send automatically.</p>
        <div><SubmitButton disabled={!available} pendingLabel="Saving…">Save reviewed settings</SubmitButton></div><ActionFeedback state={saved}/>
      </form>:null}
    </>:connection ? <p>Reconnect the company’s Airtable access before changing its settings.</p>:null}
  </div>;
}
