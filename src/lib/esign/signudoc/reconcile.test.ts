// @vitest-environment node
import {beforeEach,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn(),attempt:vi.fn(),metadata:vi.fn(),upsert:vi.fn(),cleanup:vi.fn(),upload:vi.fn(),readStored:vi.fn(),command:vi.fn(),download:vi.fn()}));
vi.mock('@/lib/storage-cleanup',()=>({registerCleanupIntent:m.cleanup}));
const {reconcileSignuDocClaim}=await import('./reconcile');
const id='11111111-1111-4111-8111-111111111111',token='22222222-2222-4222-8222-222222222222',envelopeId='33333333-3333-4333-8333-333333333333';
const bytes=Buffer.from('%PDF-SYNTHETIC-FINAL'),hash=createHash('sha256').update(bytes).digest('hex');
const claim={id,claim_ref:'CMG-SYNTHETIC',status:'lor_sent' as const,esign_status:'document.sent',pandadoc_document_id:'signudoc:'+envelopeId,esign_active_attempt_token:token,esign_dispatch_token:null};
const completed={version:1 as const,firmId:'44444444-4444-4444-8444-444444444444',claimId:id,attemptToken:token,envelopeId,status:'completed' as const,sourceSha256:'a'.repeat(64),deliveryConfirmed:true,sendStarted:true,signers:[{role:'Homeowner1' as const,name:'Avery Synthetic',email:'avery@example.invalid',status:'signed' as const,signedAt:1800000000}],artifacts:{signedSha256:hash,evidenceSha256:hash}};
const admin={rpc:m.rpc,from:(table:string)=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:table==='esign_dispatch_attempts'?m.attempt:m.metadata})})}),insert:m.upsert}),storage:{from:()=>({upload:m.upload,download:m.readStored})}};
const deps={admin:admin as never,client:{command:m.command,download:m.download}};
beforeEach(()=>{vi.clearAllMocks();m.command.mockResolvedValue(completed);m.download.mockResolvedValue(bytes);m.attempt.mockResolvedValue({data:{mode:'signudoc',provider_document_id:claim.pandadoc_document_id},error:null});m.rpc.mockImplementation(async(name:string)=>({data:name==='esign_attempt_is_active'?true:name==='finalize_esign_pdf'?{status:'recorded'}:'applied',error:null}));m.cleanup.mockResolvedValue(true);m.upload.mockResolvedValue({error:null});m.readStored.mockResolvedValue({error:null,data:new Blob([bytes])});m.upsert.mockResolvedValue({error:null});m.metadata.mockResolvedValue({data:{claim_id:id,storage_path:`claims/${id}/signudoc-${token}-evidence-${hash.slice(0,12)}.pdf`},error:null});});
it('files both verified artifacts before advancing the claim',async()=>{
 const result=await reconcileSignuDocClaim(claim,deps);expect(result.filed).toBe(true);expect(m.download).toHaveBeenCalledTimes(2);expect(m.upload).toHaveBeenCalledTimes(2);expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({kind:'other',visibility:'internal',external_event_key:'signudoc:'+token+':evidence'}));
 const final=m.rpc.mock.calls.findIndex(c=>c[0]==='finalize_esign_pdf');expect(final).toBeGreaterThanOrEqual(0);expect(m.upsert.mock.invocationCallOrder[0]).toBeLessThan(m.rpc.mock.invocationCallOrder[final]);
});
it('does not file or advance without both artifacts, cleanup intent and persistence',async()=>{
 m.download.mockRejectedValueOnce(new Error('artifact unavailable'));await expect(reconcileSignuDocClaim(claim,deps)).rejects.toThrow();expect(m.upload).not.toHaveBeenCalled();expect(m.rpc.mock.calls.some(c=>c[0]==='finalize_esign_pdf')).toBe(false);
 m.download.mockResolvedValue(bytes);m.cleanup.mockResolvedValue(false);await expect(reconcileSignuDocClaim(claim,deps)).rejects.toThrow();expect(m.upload).not.toHaveBeenCalled();
});
it('refuses stale or non-SignuDoc ownership before remote access and refuses mismatched remote identity',async()=>{
 await expect(reconcileSignuDocClaim({...claim,pandadoc_document_id:'pandadoc-other'},deps)).rejects.toThrow();expect(m.command).not.toHaveBeenCalled();
 m.command.mockResolvedValue({...completed,envelopeId:'99999999-9999-4999-8999-999999999999'});await expect(reconcileSignuDocClaim(claim,deps)).rejects.toThrow();expect(m.upload).not.toHaveBeenCalled();
});
it('shows outstanding signers without downloading incomplete agreements',async()=>{
 m.command.mockResolvedValue({...completed,status:'sent',signers:[{...completed.signers[0],status:'notified',signedAt:null}],artifacts:{signedSha256:null,evidenceSha256:null}});
 const result=await reconcileSignuDocClaim(claim,deps);expect(result.filed).toBe(false);expect(result.message).toContain('Avery Synthetic');expect(m.download).not.toHaveBeenCalled();
});
it('keeps uncertain delivery locked until the provider supplies positive delivery evidence',async()=>{
 m.command.mockResolvedValue({...completed,status:'sent',deliveryConfirmed:false,signers:[{...completed.signers[0],status:'pending',signedAt:null}]});const result=await reconcileSignuDocClaim({...claim,esign_dispatch_token:token},deps);expect(result.filed).toBe(false);expect(m.rpc.mock.calls.some(c=>c[0]==='reconcile_esign_dispatch')).toBe(false);expect(m.download).not.toHaveBeenCalled();
});

it('uses a fresh object path and succeeds after a failed filing is cleaned up',async()=>{
 m.upsert.mockResolvedValue({error:{message:'Synthetic persistence failure'}});m.metadata.mockResolvedValue({data:null,error:null});
 await expect(reconcileSignuDocClaim(claim,deps)).rejects.toThrow();const first=m.upload.mock.calls.map(c=>c[0]);
 m.upload.mockClear();m.upsert.mockResolvedValue({error:null});m.metadata.mockImplementation(async()=>({data:{claim_id:id,storage_path:m.upsert.mock.calls.at(-1)?.[0].storage_path},error:null}));
 const result=await reconcileSignuDocClaim(claim,deps);expect(result.filed).toBe(true);expect(m.upload.mock.calls.every(c=>!first.includes(c[0]))).toBe(true);
});
