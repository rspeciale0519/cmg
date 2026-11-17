import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const {sealReview,openReview}=await import('./review-token');
const now=1800000000000,key='synthetic-review-key-fixture-only-01234567890123456789';
const record={version:1 as const,actorId:'11111111-1111-4111-8111-111111111111',claimId:'22222222-2222-4222-8222-222222222222',requestId:'33333333-3333-4333-8333-333333333333',reviewId:'44444444-4444-4444-8444-444444444444',contentsSha256:'a'.repeat(64),sourceSha256:'b'.repeat(64),issuedAt:now,expiresAt:now+600000};
it('accepts only the exact reviewed actor/claim/request/content snapshot within its lifetime',()=>{
 const token=sealReview(record,key);expect(openReview(token,key,record,now)).toEqual(record);
 for(const field of ['actorId','claimId','requestId','contentsSha256'] as const)expect(openReview(token,key,{...record,[field]:'changed'},now)).toBeNull();
 expect(openReview(token,key,record,now+600001)).toBeNull();expect(openReview(token,key,record,now-31000)).toBeNull();
});
it('refuses token edits, wrong keys, oversized tokens and excessive lifetimes',()=>{
 const token=sealReview(record,key);expect(openReview(token+'x',key,record,now)).toBeNull();expect(openReview(token,key+'x',record,now)).toBeNull();expect(openReview('x'.repeat(5000),key,record,now)).toBeNull();
 expect(openReview(sealReview({...record,expiresAt:now+900000},key),key,record,now)).toBeNull();
});
