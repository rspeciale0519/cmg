import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database-app';
import {registerCleanupIntent} from '@/lib/storage-cleanup';
import type {SignuDocClient,BridgeStatus} from './client';
export type ReconcileClaim=Pick<Database['public']['Tables']['claims']['Row'],'id'|'claim_ref'|'status'|'esign_status'|'pandadoc_document_id'|'esign_active_attempt_token'|'esign_dispatch_token'>;
export type ReconcileResult={ok:true;filed:boolean;canRemind:boolean;message:string;signers:BridgeStatus['signers']};
type Admin=SupabaseClient<Database>;
const bucket='claim-docs';
function unavailable():never{throw new Error('Signing request reconciliation is unavailable.');}
async function storeArtifact(admin:Admin,claimId:string,objectPath:string,bytes:Uint8Array,hash:string){
 if(!await registerCleanupIntent(admin,bucket,objectPath,claimId))unavailable();
 const result=await admin.storage.from(bucket).upload(objectPath,bytes,{contentType:'application/pdf',upsert:false});
 if(!result.error)return;
 if(!result.error.message.toLowerCase().includes('already exists'))unavailable();
 const existing=await admin.storage.from(bucket).download(objectPath);
 if(existing.error||!existing.data)unavailable();
 const stored=new Uint8Array(await existing.data.arrayBuffer());
 if(createHash('sha256').update(stored).digest('hex')!==hash)unavailable();
}
export async function reconcileSignuDocClaim(claim:ReconcileClaim,{admin,client}:{admin:Admin;client:Pick<SignuDocClient,'command'|'download'>}):Promise<ReconcileResult>{
 const reference=claim.pandadoc_document_id,attempt=claim.esign_active_attempt_token;
 if(!reference||!/^signudoc:[a-f0-9-]{36}$/.test(reference)||!attempt||(claim.esign_dispatch_token&&claim.esign_dispatch_token!==attempt))unavailable();
 const owned=await admin.from('esign_dispatch_attempts').select('mode,provider_document_id').eq('claim_id',claim.id).eq('claim_token',attempt).maybeSingle();
 if(owned.error||owned.data?.mode!=='signudoc'||owned.data.provider_document_id!==reference)unavailable();
 const active=await admin.rpc('esign_attempt_is_active',{p_claim_id:claim.id,p_document_id:reference,p_attempt_token:attempt});
 if(active.error||active.data!==true)unavailable();
 const binding={claimId:claim.id,attemptToken:attempt};
 const status=await client.command({action:'status',...binding});
 if('signudoc:'+status.envelopeId!==reference||status.claimId!==claim.id||status.attemptToken!==attempt)unavailable();
 const signed=status.signers.filter(s=>s.status==='signed').length;
 const result=(message:string,filed=false):ReconcileResult=>({ok:true,filed,message,canRemind:status.status==='sent'&&status.deliveryConfirmed&&signed<status.signers.length,signers:status.signers});
 if(!status.deliveryConfirmed&&signed===0)return result('Delivery is not confirmed. Keep this request locked and do not resend.');
 if(claim.esign_dispatch_token){
  const reconciled=await admin.rpc('reconcile_esign_dispatch',{p_claim_id:claim.id,p_document_id:reference,p_attempt_token:attempt,p_outcome:'delivered'});
  if(reconciled.error||!['delivered','duplicate'].includes(reconciled.data))unavailable();
 }
 const remoteState=status.status==='completed'?'document.completed':status.status==='sent'?(signed>0?`recipient.completed:${signed}:${status.signers.length}`:'document.sent'):`document.${status.status}`;
 const applied=await admin.rpc('apply_esign_webhook_state',{p_claim_id:claim.id,p_document_id:reference,p_attempt_token:attempt,p_status:remoteState});
 if(applied.error||!['applied','ignored'].includes(applied.data))unavailable();
 if(status.status!=='completed'){
  const waiting=status.signers.filter(s=>s.status!=='signed').map(s=>s.name);
  return result(['declined','voided','expired'].includes(status.status)?'The signing request is '+status.status+'. Review it before starting another agreement.':'Waiting for: '+waiting.join(', ')+'.');
 }
 if(signed!==status.signers.length||!status.artifacts.signedSha256||!status.artifacts.evidenceSha256)unavailable();
 const signedBytes=await client.download(binding,'signed',status.artifacts.signedSha256);
 const evidenceBytes=await client.download(binding,'evidence',status.artifacts.evidenceSha256);
 const artifacts=[{kind:'signed',bytes:signedBytes,hash:status.artifacts.signedSha256},{kind:'evidence',bytes:evidenceBytes,hash:status.artifacts.evidenceSha256}].map(a=>({...a,objectPath:`claims/${claim.id}/signudoc-${attempt}-${a.kind}-${a.hash.slice(0,12)}-${randomUUID()}.pdf`}));
 for(const artifact of artifacts){
  if(artifact.bytes.length===0||artifact.bytes.length>10000000||createHash('sha256').update(artifact.bytes).digest('hex')!==artifact.hash||Buffer.from(artifact.bytes.subarray(0,5)).toString()!=='%PDF-')unavailable();
  await storeArtifact(admin,claim.id,artifact.objectPath,artifact.bytes,artifact.hash);
 }
 const evidence=artifacts[1],signedFile=artifacts[0],eventKey='signudoc:'+attempt+':evidence';
 const filedEvidence=await admin.from('documents').insert({claim_id:claim.id,storage_path:evidence.objectPath,original_name:`LOR ${claim.claim_ref} (SignuDoc audit evidence).pdf`,kind:'other',mime:'application/pdf',size_bytes:evidence.bytes.length,visibility:'internal',external_event_key:eventKey});
 // A conflicting insert rolls back its cleanup-settling trigger. The new
 // unreferenced object therefore remains eligible for cleanup.
 const matching=await admin.from('documents').select('claim_id,storage_path').eq('external_event_key',eventKey).eq('claim_id',claim.id).maybeSingle();
 if(matching.error||matching.data?.claim_id!==claim.id||!matching.data.storage_path?.startsWith(`claims/${claim.id}/`))unavailable();
 if(filedEvidence.error||matching.data.storage_path!==evidence.objectPath){
  const retained=await admin.storage.from(bucket).download(matching.data.storage_path);
  if(retained.error||!retained.data||createHash('sha256').update(new Uint8Array(await retained.data.arrayBuffer())).digest('hex')!==evidence.hash)unavailable();
 }
 const finalized=await admin.rpc('finalize_esign_pdf',{p_claim_id:claim.id,p_document_id:reference,p_attempt_token:attempt,p_external_event_key:'signudoc:'+attempt+':signed',p_storage_path:signedFile.objectPath,p_original_name:`LOR ${claim.claim_ref} (signed).pdf`,p_size_bytes:signedFile.bytes.length});
 if(finalized.error||!finalized.data||typeof finalized.data!=='object'||Array.isArray(finalized.data)||finalized.data.status!=='recorded')unavailable();
 return result('The signed agreement and audit evidence are filed with this claim.',true);
}
