import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
const recordSchema=z.object({version:z.literal(1),actorId:z.uuid(),claimId:z.uuid(),requestId:z.uuid(),reviewId:z.uuid(),contentsSha256:z.string().regex(/^[a-f0-9]{64}$/),sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),issuedAt:z.number().int().positive(),expiresAt:z.number().int().positive()}).strict();
export type ReviewRecord=z.infer<typeof recordSchema>;
export function sealReview(record:ReviewRecord,key:string):string{
 if(key.trim().length<32)throw new Error('Review configuration unavailable');
 const payload=Buffer.from(JSON.stringify(recordSchema.parse(record))).toString('base64url');
 return payload+'.'+createHmac('sha256',key).update('cmg-review-v1\n'+payload).digest('hex');
}
export function openReview(token:string,key:string,expected:Pick<ReviewRecord,'actorId'|'claimId'|'requestId'|'contentsSha256'>,now=Date.now()):ReviewRecord|null{
 if(token.length>4000||key.trim().length<32)return null;
 const parts=token.split('.');if(parts.length!==2||!/^[a-f0-9]{64}$/.test(parts[1]))return null;
 const signature=createHmac('sha256',key).update('cmg-review-v1\n'+parts[0]).digest();
 if(!timingSafeEqual(signature,Buffer.from(parts[1],'hex')))return null;
 try{
  const record=recordSchema.parse(JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')));
  if(record.expiresAt<=now||record.issuedAt>now+30000||record.expiresAt-record.issuedAt>600000||record.expiresAt<=record.issuedAt)return null;
  if(record.actorId!==expected.actorId||record.claimId!==expected.claimId||record.requestId!==expected.requestId||record.contentsSha256!==expected.contentsSha256)return null;
  return record;
 }catch{return null;}
}
