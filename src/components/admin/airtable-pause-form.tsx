"use client";
import { useActionState } from "react";
import { setAirtableCompanyPaused,setAirtableClaimPaused } from "@/lib/actions/airtable-pause";
import { idleState } from "@/lib/actions/types";
import { ActionFeedback,SubmitButton } from "./form-controls";
export function AirtablePauseForm({id,kind,enabled}:{id:string;kind:"company"|"claim";enabled:boolean}) {
  const [state,action]=useActionState(kind==="company"?setAirtableCompanyPaused:setAirtableClaimPaused,idleState);
  return <form action={action} className="grid gap-2 text-sm">
    <input type="hidden" name={kind==="company"?"companyId":"claimId"} value={id}/>
    <input type="hidden" name="paused" value={enabled?"true":"false"}/>
    <div><SubmitButton pendingLabel="Saving…" variant="secondary">{enabled?"Pause sharing":"Resume checks with review"}</SubmitButton></div>
    <p className="text-ink/65">{enabled?"Pause stops future attempts. A request that already started can still finish.":"Resume keeps old updates held. Check uncertain results, then review current values before sending."}</p>
    <ActionFeedback state={state}/>
  </form>;
}
