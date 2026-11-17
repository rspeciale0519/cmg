'use client';
import {useActionState,useEffect,useState,useTransition} from 'react';
import {prepareAgreementReview,refreshSignuDocAgreement,remindSignuDocSigner} from '@/lib/actions/signudoc';
import {submitLorRecovery} from '@/lib/actions/esign';
import {idleState,resilient} from '@/lib/actions/types';
import type {SignuDocReview} from '@/lib/esign/signudoc/review';
import {ActionFeedback,AdminButton,SubmitButton} from './form-controls';

type ReadyReview=Extract<SignuDocReview,{ok:true}>;
type Signer={role:string;name:string;status:string};
function downloadReview(review:ReadyReview){
 const binary=atob(review.pdfBase64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),anchor=document.createElement('a');
 anchor.href=url;anchor.download=review.filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
export function SignuDocControls({claimId,requestId,canStart,canRefresh,ready}:{claimId:string;requestId:string;canStart:boolean;canRefresh:boolean;ready:boolean}){
 const [review,setReview]=useState<ReadyReview|null>(null),[confirmed,setConfirmed]=useState(false),[pending,start]=useTransition();
 const [feedback,setFeedback]=useState(''),[signers,setSigners]=useState<Signer[]>([]),[canRemind,setCanRemind]=useState(false),[reminderUsed,setReminderUsed]=useState(false);
 const [sendState,sendAction]=useActionState(resilient(submitLorRecovery),idleState);
 useEffect(()=>{if(!review)return;const timer=setTimeout(()=>{setReview(null);setConfirmed(false);setFeedback('The review expired. Prepare the current agreement again.');},Math.max(0,review.expiresAt-Date.now()));return()=>clearTimeout(timer);},[review]);
 const prepare=()=>start(async()=>{
  setFeedback('');setConfirmed(false);setReview(null);
  try{const result=await prepareAgreementReview(claimId,requestId);if(!result.ok){setFeedback(result.message);return;}downloadReview(result);setReview(result);}
  catch{setFeedback('The review could not be prepared. Nothing was sent.');}
 });
 const refresh=()=>start(async()=>{
  try{const result=await refreshSignuDocAgreement(claimId);setFeedback(result.message);if(result.ok){setSigners(result.signers);setCanRemind(result.canRemind);}}
  catch{setFeedback('Status could not be confirmed. Keep the current request; do not resend.');}
 });
 const remind=()=>start(async()=>{
  setReminderUsed(true);
  try{const result=await remindSignuDocSigner(claimId,requestId);setFeedback(result.message);if(result.ok)setSigners(result.signers);}
  catch{setFeedback('The reminder could not be confirmed. Refresh status before another attempt.');}
 });
 return <section className="mt-4 space-y-3" aria-label="SignuDoc agreement controls">
  {canStart?<>
   <AdminButton type="button" onClick={prepare} disabled={pending||!ready}>{pending?'Preparing…':'Prepare agreement for review'}</AdminButton>
   <p className="text-[12px] leading-[1.6] text-ink/65">Download and read every page before sending. Check the homeowners, email addresses, fee and agreement terms. This review lasts 10 minutes.</p>
   {review?<div className="border border-ink/15 p-3 text-[13px]">
    <p className="font-medium">Agreement: {review.agreement.replaceAll('_',' ')} · Fee: {review.feePercent}%</p>
    <ul className="mt-2 space-y-2" aria-label="Reviewed recipients">{review.recipients.map(s=><li key={s.role}><span>{s.name}</span> — <span>{s.email}</span></li>)}</ul>
    <AdminButton type="button" onClick={()=>downloadReview(review)}>Download review again</AdminButton>
   </div>:null}
   <form action={sendAction} className="space-y-3">
    <input type="hidden" name="claimId" value={claimId}/><input type="hidden" name="requestId" value={requestId}/>
    <input type="hidden" name="reviewToken" value={review?.token??''}/>
    <label className="flex items-start gap-2 text-[13px] leading-[1.6]"><input type="checkbox" name="reviewConfirmed" value="yes" checked={confirmed} disabled={!review||pending} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the agreement and recipients and approve sending this version.</label>
    <div className="flex flex-wrap gap-2"><SubmitButton name="intent" value="electronic" disabled={!review||!confirmed||!ready||pending} pendingLabel="Sending…">Send reviewed agreement</SubmitButton><SubmitButton name="intent" value="manual" variant="secondary" pendingLabel="Switching…">Use manual signing</SubmitButton></div>
    <ActionFeedback state={sendState}/>
   </form>
  </>:null}
  {canRefresh?<div className="space-y-3">
   <AdminButton type="button" onClick={refresh} disabled={pending}>Refresh signing status</AdminButton>
   {signers.length?<ul className="space-y-1 text-[13px]" aria-label="Homeowner signing progress">{signers.map(s=><li key={s.role}>{s.name}: {s.status==='signed'?'Signed':s.status==='declined'?'Declined':'Waiting'}</li>)}</ul>:null}
   {canRemind?<div><p className="mb-2 text-[12px] text-ink/65">Email a reminder to the homeowner whose turn it is. Completed homeowners are not contacted.</p><AdminButton type="button" onClick={remind} disabled={pending||reminderUsed}>Send reminder email</AdminButton></div>:null}
  </div>:null}
  {feedback?<p role="status" className="text-[13px] leading-[1.6] text-ink/75">{feedback}</p>:null}
 </section>;
}
