import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database-app';
import {createAdminClient} from '@/lib/supabase/admin';
import {writeAuditStrict} from '@/lib/audit';
import {registerCleanupIntent} from '@/lib/storage-cleanup';
import {collectLorLetter,loadLorClaim,type LorLetterContents} from '../lor-letter';
import {buildPrefilledLorPdf} from '../lor-prefill';
import {lorPdfName} from '../lor-pdf';
import manifest from '../lor-tag-manifest.json';
import {ESignError,PANDADOC_TERMINAL_FAILURE_STATUSES} from '../types';
import {authorizeSignuDocClaim} from './authorize';
import {readSignuDocSettings} from './config';
import {sealReview,openReview} from './review-token';

type Admin=SupabaseClient<Database>;
const bucket='claim-docs';
export type SignuDocReview={ok:true;token:string;pdfBase64:string;filename:string;recipients:{role:string;name:string;email:string}[];feePercent:number;agreement:string;expiresAt:number}|{ok:false;message:string};
export async function reviewContentsHash(letter:Pick<LorLetterContents,'signers'|'tokens'|'feePercent'>):Promise<string>{
 const asset=await readFile(path.join(process.cwd(),'src/lib/esign/templates',lorPdfName(letter.signers.length)));
 const content={version:1,signers:[...letter.signers].sort((a,b)=>a.role.localeCompare(b.role)),tokens:[...letter.tokens].sort((a,b)=>a.name.localeCompare(b.name)),feePercent:letter.feePercent,assetSha256:createHash('sha256').update(asset).digest('hex'),manifest};
 return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}
export async function prepareSignuDocReview(claimId:string,requestId:string):Promise<SignuDocReview>{
 const allowed=await authorizeSignuDocClaim(claimId);
 if(!allowed)return {ok:false,message:'That signing request is not available.'};
 const settings=readSignuDocSettings();
 if(!settings.enabled||!settings.config||!/^[a-f0-9-]{36}$/i.test(requestId))return {ok:false,message:'The signing service is not available.'};
 const admin=createAdminClient(),claim=await loadLorClaim(admin,claimId);
 const retryable=['document.creation_failed',...PANDADOC_TERMINAL_FAILURE_STATUSES] as string[];
 if(!claim||!(claim.status==='under_review'||(claim.status==='lor_sent'&&retryable.includes(claim.esign_status??''))))return {ok:false,message:'This claim is not available for a new signing request.'};
 const letter=await collectLorLetter(admin,claim);if(!letter.ok)return {ok:false,message:letter.message};
 try{
  const now=new Date(),pdf=await buildPrefilledLorPdf({signers:letter.signers,tokens:letter.tokens},now),reviewId=randomUUID();
  const objectPath=`claims/${claimId}/signudoc-review-${reviewId}.pdf`;
  // Existing cleanup grace is 15 minutes; this review expires after 10.
  if(!await registerCleanupIntent(admin,bucket,objectPath,claimId))throw Error('cleanup unavailable');
  const stored=await admin.storage.from(bucket).upload(objectPath,pdf,{contentType:'application/pdf',upsert:false});if(stored.error)throw Error('review unavailable');
  const record={version:1 as const,actorId:allowed.session.userId,claimId,requestId,reviewId,contentsSha256:await reviewContentsHash(letter),sourceSha256:createHash('sha256').update(pdf).digest('hex'),issuedAt:now.getTime(),expiresAt:now.getTime()+600000};
  await writeAuditStrict(admin,{actorId:allowed.session.userId,action:'esign.signudoc_review_prepared',entity:'claims',entityId:claimId,meta:{request_id:requestId,review_id:reviewId,contents_sha256:record.contentsSha256,source_sha256:record.sourceSha256}});
  return {ok:true,token:sealReview(record,settings.config.key),pdfBase64:Buffer.from(pdf).toString('base64'),filename:`LOR-${claim.claim_ref}-review.pdf`,recipients:letter.signers.map(s=>({role:s.role,name:s.firstName+' '+s.lastName,email:s.email})),feePercent:letter.feePercent,agreement:claim.lor_contract_type??'',expiresAt:record.expiresAt};
 }catch{return {ok:false,message:'The agreement review could not be prepared. Nothing was sent.'};}
}
export async function loadReviewedSignuDocPdf(admin:Admin,input:{claimId:string;requestId:string;actorId:string|null;token?:string;letter:LorLetterContents}):Promise<Uint8Array>{
 const settings=readSignuDocSettings();
 const record=input.token&&settings.config&&input.actorId?openReview(input.token,settings.config.key,{actorId:input.actorId,claimId:input.claimId,requestId:input.requestId,contentsSha256:await reviewContentsHash(input.letter)}):null;
 if(!record)throw new ESignError('creation_failed','Review the current agreement and recipients before sending.');
 const stored=await admin.storage.from(bucket).download(`claims/${input.claimId}/signudoc-review-${record.reviewId}.pdf`);
 if(stored.error||!stored.data)throw new ESignError('creation_failed','The reviewed agreement is unavailable. Review it again.');
 const bytes=new Uint8Array(await stored.data.arrayBuffer());
 if(bytes.length>2400000||createHash('sha256').update(bytes).digest('hex')!==record.sourceSha256)throw new ESignError('creation_failed','The reviewed agreement could not be verified.');
 return bytes;
}
