// @vitest-environment node
import {beforeEach,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({authorize:vi.fn(),admin:vi.fn(),load:vi.fn(),collect:vi.fn(),build:vi.fn(),cleanup:vi.fn(),upload:vi.fn(),download:vi.fn(),audit:vi.fn(),settings:vi.fn()}));
vi.mock('./authorize',()=>({authorizeSignuDocClaim:mocks.authorize}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:mocks.admin}));
vi.mock('../lor-letter',()=>({loadLorClaim:mocks.load,collectLorLetter:mocks.collect}));
vi.mock('../lor-prefill',()=>({buildPrefilledLorPdf:mocks.build}));
vi.mock('@/lib/storage-cleanup',()=>({registerCleanupIntent:mocks.cleanup}));
vi.mock('@/lib/audit',()=>({writeAuditStrict:mocks.audit}));
vi.mock('./config',()=>({readSignuDocSettings:mocks.settings}));
const {prepareSignuDocReview,loadReviewedSignuDocPdf,reviewContentsHash}=await import('./review');
const {openReview}=await import('./review-token');
const actor='11111111-1111-4111-8111-111111111111',claimId='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333';
const key='synthetic-review-key-fixture-only-01234567890123456789';
const bytes=Buffer.from('%PDF-SYNTHETIC-REVIEW');
const letter={signers:[{role:'Homeowner1' as const,firstName:'Avery',lastName:'Synthetic',email:'avery@example.invalid'}],tokens:[{name:'Fee.Percent',value:'10'}],feePercent:10,adjusterName:'Synthetic Adjuster'};
const admin={storage:{from:()=>({upload:mocks.upload,download:mocks.download})}};
beforeEach(()=>{vi.clearAllMocks();mocks.authorize.mockResolvedValue({session:{userId:actor},claim:{id:claimId}});mocks.admin.mockReturnValue(admin);mocks.load.mockResolvedValue({id:claimId,status:'under_review',claim_ref:'CMG-SYNTHETIC',lor_contract_type:'non_emergency'});mocks.collect.mockResolvedValue({ok:true,...letter});mocks.build.mockResolvedValue(bytes);mocks.cleanup.mockResolvedValue(true);mocks.upload.mockResolvedValue({error:null});mocks.download.mockResolvedValue({error:null,data:new Blob([bytes])});mocks.audit.mockResolvedValue(undefined);mocks.settings.mockReturnValue({enabled:true,config:{key}});});
it('keeps exact reviewed bytes private and binds the review to current contents and actor',async()=>{
 const result=await prepareSignuDocReview(claimId,requestId);expect(result.ok).toBe(true);if(!result.ok)throw Error('review failed');
 expect(result.pdfBase64).toBe(bytes.toString('base64'));expect(result.recipients[0].email).toBe(letter.signers[0].email);
 const contentsSha256=await reviewContentsHash(letter);expect(contentsSha256).toMatch(/^[a-f0-9]{64}$/);
 const record=openReview(result.token,key,{actorId:actor,claimId,requestId,contentsSha256});expect(record?.sourceSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
 await expect(loadReviewedSignuDocPdf(admin as never,{claimId,requestId,actorId:actor,token:result.token,letter})).resolves.toEqual(new Uint8Array(bytes));
 await expect(loadReviewedSignuDocPdf(admin as never,{claimId,requestId,actorId:actor,token:result.token,letter:{...letter,feePercent:12}})).rejects.toThrow();
});
it('performs no privileged read/upload when claim management is refused',async()=>{mocks.authorize.mockResolvedValue(null);expect((await prepareSignuDocReview(claimId,requestId)).ok).toBe(false);expect(mocks.admin).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();});
it('withholds a review unless cleanup intent and strict audit succeed',async()=>{
 mocks.cleanup.mockResolvedValue(false);expect((await prepareSignuDocReview(claimId,requestId)).ok).toBe(false);expect(mocks.upload).not.toHaveBeenCalled();
 mocks.cleanup.mockResolvedValue(true);mocks.audit.mockRejectedValue(new Error('audit unavailable'));expect((await prepareSignuDocReview(claimId,requestId)).ok).toBe(false);
});
it('refuses missing/altered approval and corrupted stored bytes before provider send',async()=>{
 await expect(loadReviewedSignuDocPdf(admin as never,{claimId,requestId,actorId:actor,letter})).rejects.toThrow();expect(mocks.download).not.toHaveBeenCalled();
 const review=await prepareSignuDocReview(claimId,requestId);if(!review.ok)throw Error('review failed');
 mocks.download.mockResolvedValue({error:null,data:new Blob([Buffer.from('%PDF-TAMPERED')])});await expect(loadReviewedSignuDocPdf(admin as never,{claimId,requestId,actorId:actor,letter,token:review.token})).rejects.toThrow();
});
