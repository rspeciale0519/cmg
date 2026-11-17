// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import type {BridgeStatus} from './client';
import type {ReconcileClaim} from './reconcile';
vi.mock('server-only',()=>({}));
vi.setConfig({testTimeout:30000,hookTimeout:30000});
const enabled=process.env.CMG_SIGNUDOC_DATABASE_TEST==='1';
const support=await import('../test-support');
const {reconcileSignuDocClaim}=await import('./reconcile');
// No optional env files or connectivity probes are read before explicit opt-in.
describe.runIf(enabled)('SignuDoc filing against disposable Supabase Auth/REST/Storage/Postgres',()=>{
 let admin:ReturnType<typeof support.testAdminClient>;
 const claims:Array<{id:string;claimRef:string}>=[];
 beforeAll(async()=>{
  if(!await support.localSupabaseAvailable())throw Error('Explicit SignuDoc database verification requires reachable local Supabase.');
  process.env.RESEND_API_KEY='';admin=support.testAdminClient();
 });
 afterAll(async()=>{if(admin)await support.cleanupFixtures(admin,claims);});
 const readClaim=async(id:string):Promise<ReconcileClaim>=>{
  const result=await admin.from('claims').select('id,claim_ref,status,esign_status,pandadoc_document_id,esign_active_attempt_token,esign_dispatch_token').eq('id',id).single();
  expect(result.error).toBeNull();if(!result.data)throw Error('Synthetic claim missing');return result.data;
 };
 for(const count of [1,2])it(`files ${count}-homeowner completion and deduplicates replay using real private storage`,async()=>{
  const claim=await support.seedClaim(admin,{status:'under_review',claimants:count});claims.push(claim);
  const requestId=randomUUID(),attempt=randomUUID(),envelope=randomUUID(),reference='signudoc:'+envelope;
  const claimed=await admin.rpc('claim_esign_dispatch',{p_claim_id:claim.id,p_request_id:requestId,p_claim_token:attempt,p_mode:'signudoc'});
  expect(claimed.error).toBeNull();expect(claimed.data).toMatchObject({status:'claimed'});
  const marked=await admin.rpc('mark_esign_dispatch_sending',{p_request_id:requestId,p_claim_token:attempt,p_provider_document_id:reference});expect(marked.error).toBeNull();expect(marked.data).toBe(true);
  const pdf=await PDFDocument.create();const page=pdf.addPage([612,792]);page.drawText('SYNTHETIC TEST ONLY - NOT AN EXECUTED AGREEMENT',{x:30,y:750,size:10});
  const bytes=await pdf.save(),hash=createHash('sha256').update(bytes).digest('hex');
  const status:BridgeStatus={version:1,firmId:randomUUID(),claimId:claim.id,attemptToken:attempt,envelopeId:envelope,status:'completed',sourceSha256:hash,deliveryConfirmed:true,sendStarted:true,signers:Array.from({length:count},(_,i)=>({role:i===0?'Homeowner1':'Homeowner2',name:`Synthetic Homeowner ${i+1}`,email:claim.claimantEmails[i],status:'signed',signedAt:Math.floor(Date.now()/1000)})),artifacts:{signedSha256:hash,evidenceSha256:hash}};
  const client={command:vi.fn(async()=>status),download:vi.fn(async()=>bytes)};
  expect((await reconcileSignuDocClaim(await readClaim(claim.id),{admin,client})).filed).toBe(true);
  const saved=await readClaim(claim.id);expect(saved.status).toBe('lor_signed');expect(saved.esign_dispatch_token).toBeNull();
  const documents=await admin.from('documents').select('kind,visibility,storage_path').eq('claim_id',claim.id);expect(documents.error).toBeNull();expect(documents.data).toHaveLength(2);
  expect(documents.data).toEqual(expect.arrayContaining([expect.objectContaining({kind:'lor_signed',visibility:'customer'}),expect.objectContaining({kind:'other',visibility:'internal'})]));
  for(const document of documents.data??[]){
   const file=await admin.storage.from('claim-docs').download(document.storage_path);expect(file.error).toBeNull();expect(file.data).toBeTruthy();expect(createHash('sha256').update(new Uint8Array(await file.data!.arrayBuffer())).digest('hex')).toBe(hash);
   const publicUrl=admin.storage.from('claim-docs').getPublicUrl(document.storage_path).data.publicUrl;
   expect((await fetch(publicUrl)).ok).toBe(false);
  }
  expect((await reconcileSignuDocClaim(saved,{admin,client})).filed).toBe(true);
  const repeated=await admin.from('documents').select('id').eq('claim_id',claim.id);expect(repeated.error).toBeNull();expect(repeated.data).toHaveLength(2);
  const audit=await admin.from('audit_log').select('id').eq('entity_id',claim.id).eq('action','esign.signudoc_artifacts_filed');expect(audit.error).toBeNull();expect(audit.data).toHaveLength(1);
  const cleanup=await admin.from('storage_cleanup_queue').select('object_path,processed_at').eq('claim_id',claim.id);expect(cleanup.error).toBeNull();
  const attached=new Set((documents.data??[]).map(d=>d.storage_path));expect(cleanup.data?.filter(row=>!attached.has(row.object_path)).every(row=>row.processed_at===null)).toBe(true);
 });
});
