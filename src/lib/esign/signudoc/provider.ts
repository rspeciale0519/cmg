import 'server-only';
import {createHash} from 'node:crypto';
import manifest from '../lor-tag-manifest.json';
import {ESignError,type ESignProvider,type LorRequest,type LorDispatch} from '../types';
import {SignuDocClient} from './client';

export class SignuDocProvider implements ESignProvider{
 readonly kind='signudoc' as const;
 readonly canSendElectronically=true;
 constructor(readonly client:SignuDocClient|null){}
 async dispatchLor(request:LorRequest):Promise<LorDispatch>{
  if(!this.client)throw new ESignError('not_configured','Signing service is not configured.');
  if(!request.beforeSend||!request.reviewedPdf?.length)throw new ESignError('creation_failed','Review the current agreement before sending.');
  if(request.signers.length<1||request.signers.length>2||request.signers[0]?.role!=='Homeowner1'||(request.signers.length===2&&request.signers[1]?.role!=='Homeowner2'))throw new ESignError('creation_failed','The agreement recipients are unavailable.');
  const variant=request.signers.length===2?'dual':'single';
  const fields=manifest.variants[variant].signature.map(f=>({role:f.role==='H1'?'Homeowner1':'Homeowner2',type:({s:'signature',i:'initials',d:'date'} as const)[f.type],page:f.page,x:f.x/612,y:(792-f.y-18)/792,width:(f.type==='i'?38:f.type==='d'?74:145)/612,height:18/792,required:!f.optional,label:f.id}));
  const binding={claimId:request.claimId,attemptToken:request.dispatchAttemptToken};
  const sourceSha256=createHash('sha256').update(request.reviewedPdf).digest('hex');
  const prepared=await this.client.command({action:'prepare',...binding,title:request.documentName,pdfBase64:Buffer.from(request.reviewedPdf).toString('base64'),sourceSha256,signers:request.signers.map(s=>({role:s.role,name:s.firstName+' '+s.lastName,email:s.email})),fields});
  if(prepared.sourceSha256!==sourceSha256||prepared.signers.length!==request.signers.length||prepared.signers.some((s,i)=>s.role!==request.signers[i].role||s.email.toLowerCase()!==request.signers[i].email.toLowerCase()||s.name!==request.signers[i].firstName+' '+request.signers[i].lastName))throw new ESignError('creation_failed','The prepared agreement could not be verified.');
  const reference='signudoc:'+prepared.envelopeId;
  await request.beforeSend(reference);
  const sent=await this.client.command({action:'send',...binding,permittedUseConfirmed:true});
  if(sent.envelopeId!==prepared.envelopeId||sent.sourceSha256!==sourceSha256||!sent.deliveryConfirmed)throw new ESignError('send_failed','Signing delivery could not be confirmed.',undefined,true);
  return {providerDocumentId:reference,esignStatus:'document.sent',deliveredByProvider:true};
 }
 /** Legacy interface lacks a claim/attempt binding; never fetch by ID alone. */
 async downloadSignedPdf(_id:string):Promise<Uint8Array>{void _id;throw new ESignError('unsupported','Use claim-bound artifact reconciliation.');}
}
