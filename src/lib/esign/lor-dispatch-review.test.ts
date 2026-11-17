// @vitest-environment node
import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({load:vi.fn(),collect:vi.fn(),review:vi.fn(),claim:vi.fn(),mark:vi.fn(),settle:vi.fn(),audit:vi.fn()}));
vi.mock('./lor-letter',()=>({loadLorClaim:m.load,collectLorLetter:m.collect}));
vi.mock('./signudoc/review',()=>({loadReviewedSignuDocPdf:m.review}));
vi.mock('./dispatch-ledger',()=>({claimDispatch:m.claim,markDispatchSending:m.mark,settleDispatch:m.settle}));
vi.mock('@/lib/audit',()=>({writeAudit:m.audit}));
const {dispatchLorForClaim}=await import('./lor-dispatch');
const id='11111111-1111-4111-8111-111111111111',requestId='22222222-2222-4222-8222-222222222222',token='33333333-3333-4333-8333-333333333333';
const bytes=Buffer.from('%PDF-REVIEWED');
const provider={kind:'signudoc' as const,canSendElectronically:true,dispatchLor:vi.fn(),downloadSignedPdf:vi.fn()};
const admin={from:()=>({update:()=>({eq:()=>({eq:()=>({select:()=>({maybeSingle:async()=>({data:{id},error:null})})})})}),insert:async()=>({error:null})})};
beforeEach(()=>{vi.clearAllMocks();m.load.mockResolvedValue({id,claim_ref:'CMG-SYNTHETIC',status:'under_review'});m.collect.mockResolvedValue({ok:true,signers:[{role:'Homeowner1',email:'avery@example.invalid',firstName:'Avery',lastName:'Synthetic'}],tokens:[],feePercent:10,adjusterName:'Synthetic'});m.review.mockResolvedValue(bytes);m.claim.mockResolvedValue({status:'claimed',token});m.mark.mockResolvedValue(true);m.settle.mockResolvedValue(true);provider.dispatchLor.mockResolvedValue({providerDocumentId:'signudoc:44444444-4444-4444-8444-444444444444',esignStatus:'document.sent',deliveredByProvider:true});});
it('requires explicit review confirmation before reserving or dispatching a SignuDoc send',async()=>{
 const result=await dispatchLorForClaim({claimId:id,requestId},{admin:admin as never,provider});
 expect(result).toMatchObject({ok:false,code:'review_required'});expect(m.claim).not.toHaveBeenCalled();expect(provider.dispatchLor).not.toHaveBeenCalled();
});
it('withholds transport when the reviewed contents or approval are no longer valid',async()=>{
 m.review.mockRejectedValue(new Error('stale review'));
 const result=await dispatchLorForClaim({claimId:id,requestId,actorId:id,reviewToken:'synthetic-token',reviewConfirmed:true},{admin:admin as never,provider});
 expect(result).toMatchObject({ok:false,code:'review_required'});expect(m.claim).not.toHaveBeenCalled();expect(provider.dispatchLor).not.toHaveBeenCalled();
});
it('carries the exact verified PDF through the existing claim-dispatch mechanism',async()=>{
 expect(await dispatchLorForClaim({claimId:id,requestId,actorId:id,reviewToken:'synthetic-token',reviewConfirmed:true},{admin:admin as never,provider})).toMatchObject({ok:true,mode:'signudoc'});
 expect(provider.dispatchLor).toHaveBeenCalledWith(expect.objectContaining({reviewedPdf:bytes,dispatchAttemptToken:token}));
});
