// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
vi.mock('server-only',()=>({}));
const {SignuDocClient}=await import('./client');
const {SignuDocProvider}=await import('./provider');
const fixture={claimId:'11111111-1111-4111-8111-111111111111',dispatchAttemptToken:'22222222-2222-4222-8222-222222222222',claimRef:'CMG-SYNTHETIC',documentName:'SYNTHETIC',signers:[{role:'Homeowner1' as const,firstName:'Avery',lastName:'Synthetic',email:'avery@example.invalid'}],tokens:[],reviewedPdf:Buffer.from('%PDF-synthetic')};
const config={origin:'https://sign.example.invalid',firmId:'33333333-3333-4333-8333-333333333333',key:'synthetic-bridge-fixture-only-01234567890123456789'};
function setup(sendFails=false){
 const calls:Record<string,unknown>[]=[];let before=false;
 const client=new SignuDocClient(config,vi.fn(async(_url,init)=>{
  const body=JSON.parse(String(init?.body));calls.push(body);
  if(body.action==='send'){expect(before).toBe(true);if(sendFails)return new Response('',{status:503});}
  return Response.json({version:1,firmId:config.firmId,claimId:fixture.claimId,attemptToken:fixture.dispatchAttemptToken,envelopeId:'44444444-4444-4444-8444-444444444444',status:body.action==='send'?'sent':'draft',sourceSha256:createHash('sha256').update(fixture.reviewedPdf).digest('hex'),sendStarted:body.action==='send',deliveryConfirmed:body.action==='send',signers:[{role:'Homeowner1',name:'Avery Synthetic',email:'avery@example.invalid',status:'pending',signedAt:null}],artifacts:{signedSha256:null,evidenceSha256:null}});
 }) as typeof fetch);
 return {provider:new SignuDocProvider(client),calls,beforeSend:async(id:string)=>{expect(id).toBe('signudoc:44444444-4444-4444-8444-444444444444');before=true;}};
}
describe('SignuDoc provider',()=>{
 it('sends exactly the reviewed PDF with every optional field and records ownership before delivery',async()=>{
  const {provider,calls,beforeSend}=setup();
  await expect(provider.dispatchLor({...fixture,beforeSend})).resolves.toMatchObject({providerDocumentId:'signudoc:44444444-4444-4444-8444-444444444444',esignStatus:'document.sent',deliveredByProvider:true});
  expect(calls.map(c=>c.action)).toEqual(['prepare','send']);
  const fields=calls[0].fields as {required:boolean}[];expect(fields).toHaveLength(11);expect(fields.filter(f=>!f.required)).toHaveLength(2);
 });
 it('never sends without reviewed bytes and the durable before-send hook',async()=>{
  const {provider,calls}=setup();
  await expect(provider.dispatchLor(fixture)).rejects.toThrow();
  expect(calls).toHaveLength(0);
 });
 it('holds an uncertain send instead of allowing an automatic duplicate',async()=>{
  const {provider,beforeSend}=setup(true);
  await expect(provider.dispatchLor({...fixture,beforeSend})).rejects.toMatchObject({deliveryUncertain:true,code:'send_failed'});
 });
});
