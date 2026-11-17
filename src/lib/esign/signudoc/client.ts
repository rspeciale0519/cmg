import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ESignError} from '../types';
import {signBridgeRequest} from './bridge-auth';

export type SignuDocConfig={origin:string;firmId:string;key:string;allowLocalTest?:boolean};
export const bridgeStatusSchema=z.object({
 version:z.literal(1),firmId:z.uuid(),claimId:z.uuid(),attemptToken:z.uuid(),envelopeId:z.uuid(),
 status:z.enum(['draft','sent','completed','declined','voided','expired']),sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),deliveryConfirmed:z.boolean(),sendStarted:z.boolean(),
 signers:z.array(z.object({role:z.enum(['Homeowner1','Homeowner2']),name:z.string().min(1).max(160),email:z.email().max(320),status:z.enum(['pending','notified','signed','declined']),signedAt:z.number().nullable()})).min(1).max(2),
 artifacts:z.object({signedSha256:z.string().regex(/^[a-f0-9]{64}$/).nullable(),evidenceSha256:z.string().regex(/^[a-f0-9]{64}$/).nullable()})
});
export type BridgeStatus=z.infer<typeof bridgeStatusSchema>;
export type BridgeBinding={claimId:string;attemptToken:string};
export function validateServiceOrigin(value:string,allowLocal=false):string{
 const url=new URL(value);
 const local=allowLocal&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname);
 if((url.protocol!=='https:'&&!local)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new ESignError('not_configured','Signing service configuration is unavailable.');
 return url.origin;
}
async function boundedBytes(response:Response,limit:number):Promise<Uint8Array>{
 if(Number(response.headers.get('content-length')??0)>limit)throw new ESignError('download_failed','Signing response is unavailable.');
 const reader=response.body?.getReader();if(!reader)throw new ESignError('download_failed','Signing response is unavailable.');
 const parts:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader.cancel();throw new ESignError('download_failed','Signing response is unavailable.');}parts.push(part.value);}}
 finally{reader.releaseLock();}
 return Buffer.concat(parts);
}
export class SignuDocClient {
 private readonly origin:string;
 constructor(readonly config:SignuDocConfig,private readonly transport:typeof fetch=fetch){
  this.origin=validateServiceOrigin(config.origin,config.allowLocalTest);
  if(config.key.trim().length<32||!z.uuid().safeParse(config.firmId).success)throw new ESignError('not_configured','Signing service configuration is unavailable.');
 }
 private async post(command:Record<string,unknown>):Promise<Response>{
  const body=JSON.stringify(command),pathname='/api/internal/cmg/v1';
  if(Buffer.byteLength(body)>3500000)throw new ESignError('creation_failed','The prepared agreement exceeds the signing service limit.');
  for(let attempt=0;;attempt++){
   // A 429 explicitly means admission was refused before the operation.
   // A network failure, timeout, 5xx or invalid reply never permits resend.
   const headers=signBridgeRequest({method:'POST',pathname,body},this.config);
   let response:Response;
   try{response=await this.transport(this.origin+pathname,{method:'POST',body,headers,redirect:'error',signal:AbortSignal.timeout(45000),cache:'no-store'});}
   catch{throw new ESignError(command.action==='send'?'send_failed':'creation_failed','Signing service request could not be confirmed.',undefined,command.action==='send');}
   if(response.status===429&&attempt<3){await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,100*2**attempt));continue;}
   if(!response.ok)throw new ESignError(command.action==='send'?'send_failed':'creation_failed','Signing service request could not be confirmed.',response.status,command.action==='send');
   return response;
  }
 }
 async command(command:Record<string,unknown>):Promise<BridgeStatus>{
  const response=await this.post(command);
  let status:BridgeStatus;
  try{status=bridgeStatusSchema.parse(JSON.parse(Buffer.from(await boundedBytes(response,131072)).toString('utf8')));}
  catch{throw new ESignError('creation_failed','Signing service response is unavailable.',undefined,command.action==='send');}
  if(status.firmId!==this.config.firmId||status.claimId!==command.claimId||status.attemptToken!==command.attemptToken)throw new ESignError('creation_failed','Signing service response ownership mismatch.',undefined,command.action==='send');
  return status;
 }
 async download(binding:BridgeBinding,artifact:'signed'|'evidence',expectedSha256:string):Promise<Uint8Array>{
  const response=await this.post({action:'download',...binding,artifact});
  const bytes=await boundedBytes(response,10000000);
  if(!/^[a-f0-9]{64}$/.test(expectedSha256)||response.headers.get('x-cmg-sha256')!==expectedSha256||createHash('sha256').update(bytes).digest('hex')!==expectedSha256||Buffer.from(bytes.subarray(0,5)).toString()!=='%PDF-')throw new ESignError('download_failed','Signing artifact verification failed.');
  return bytes;
 }
}
