'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {createAdminClient} from '@/lib/supabase/admin';
import {writeAuditStrict} from '@/lib/audit';
import {authorizeSignuDocClaim} from '@/lib/esign/signudoc/authorize';
import {readSignuDocSettings} from '@/lib/esign/signudoc/config';
import {SignuDocClient} from '@/lib/esign/signudoc/client';
import {prepareSignuDocReview} from '@/lib/esign/signudoc/review';
import {reconcileSignuDocClaim} from '@/lib/esign/signudoc/reconcile';

export async function prepareAgreementReview(claimId:string,requestId:string){return prepareSignuDocReview(claimId,requestId);}
export async function refreshSignuDocAgreement(claimId:string){
 const allowed=await authorizeSignuDocClaim(claimId);
 if(!allowed)return {ok:false as const,message:'That signing request is not available.'};
 const settings=readSignuDocSettings();if(!settings.config)return {ok:false as const,message:'The signing service is not configured.'};
 try{
  const result=await reconcileSignuDocClaim(allowed.claim,{admin:createAdminClient(),client:new SignuDocClient(settings.config)});
  revalidatePath(`/admin/claims/${claimId}`,'layout');revalidatePath('/admin/claims');return result;
 }catch{return {ok:false as const,message:'Signing status could not be confirmed. Keep the current request; do not resend.'};}
}
export async function remindSignuDocSigner(claimId:string,operationId:string){
 const allowed=await authorizeSignuDocClaim(claimId);
 if(!allowed||!z.uuid().safeParse(operationId).success)return {ok:false as const,message:'That signing request is not available.'};
 const settings=readSignuDocSettings(),claim=allowed.claim;
 if(!settings.config||!claim.pandadoc_document_id?.startsWith('signudoc:')||!claim.esign_active_attempt_token||claim.status!=='lor_sent')return {ok:false as const,message:'A reminder is not available for this request.'};
 const admin=createAdminClient(),binding={claimId,attemptToken:claim.esign_active_attempt_token};
 try{
  const client=new SignuDocClient(settings.config),status=await client.command({action:'status',...binding});
  if('signudoc:'+status.envelopeId!==claim.pandadoc_document_id||status.status!=='sent'||!status.deliveryConfirmed)return {ok:false as const,message:'A reminder is not available for this request.'};
  // The action is explicitly requested by staff; strict audit precedes delivery.
  await writeAuditStrict(admin,{actorId:allowed.session.userId,action:'esign.signudoc_reminder_requested',entity:'claims',entityId:claimId,meta:{operation_id:operationId,attempt_token:binding.attemptToken}});
  const reminded=await client.command({action:'remind',...binding,operationId});
  revalidatePath(`/admin/claims/${claimId}`,'layout');return {ok:true as const,message:'A reminder was sent to the homeowner whose turn it is.',signers:reminded.signers};
 }catch{return {ok:false as const,message:'The reminder could not be confirmed. Refresh the signing status before trying again.'};}
}
