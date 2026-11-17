import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const {SignuDocClient,validateServiceOrigin}=await import('./client');
const {verifyBridgeRequest}=await import('./bridge-auth');
const config={origin:'https://sign.example.invalid',firmId:'11111111-1111-4111-8111-111111111111',key:'synthetic-bridge-fixture-only-01234567890123456789'};
const binding={claimId:'22222222-2222-4222-8222-222222222222',attemptToken:'33333333-3333-4333-8333-333333333333'};
const payload={version:1,firmId:config.firmId,...binding,envelopeId:'44444444-4444-4444-8444-444444444444',status:'draft',sourceSha256:'a'.repeat(64),deliveryConfirmed:false,sendStarted:false,signers:[{role:'Homeowner1',name:'Avery Synthetic',email:'avery@example.invalid',status:'pending',signedAt:null}],artifacts:{signedSha256:null,evidenceSha256:null}};
describe('SignuDoc service boundary',()=>{
 it('refuses insecure, credential-bearing, query and path origins; loopback requires an explicit local flag',()=>{
  for(const url of ['http://example.invalid','https://name:pass@example.invalid','https://example.invalid/path','https://example.invalid?key=secret','http://127.0.0.1:3187'])expect(()=>validateServiceOrigin(url)).toThrow();
  expect(validateServiceOrigin('http://127.0.0.1:3187',true)).toBe('http://127.0.0.1:3187');
 });
 it('signs the exact body, refuses redirects and binds the response to firm/claim/attempt',async()=>{
  const transport=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
   expect(String(input)).toBe(config.origin+'/api/internal/cmg/v1');
   expect(init?.redirect).toBe('error');
   expect(verifyBridgeRequest({method:'POST',pathname:'/api/internal/cmg/v1',body:String(init?.body),headers:new Headers(init?.headers)},config)).toBeTruthy();
   return Response.json(payload);
  });
  const client=new SignuDocClient(config,transport as typeof fetch);
  await expect(client.command({action:'status',...binding})).resolves.toEqual(payload);
 });
 it('refuses a correctly formed response belonging to another claim, firm or attempt',async()=>{
  for(const key of ['claimId','firmId','attemptToken'] as const){
   const client=new SignuDocClient(config,vi.fn(async()=>Response.json({...payload,[key]:'99999999-9999-4999-8999-999999999999'})) as typeof fetch);
   await expect(client.command({action:'status',...binding})).rejects.toThrow();
  }
 });
 it('does not echo provider text or sensitive body content in errors',async()=>{
  const client=new SignuDocClient(config,vi.fn(async()=>new Response('secret-personal-details',{status:500})) as typeof fetch);
  await expect(client.command({action:'status',...binding})).rejects.not.toThrow('secret-personal-details');
 });
});
it('retries only explicit busy rejections with new nonces and never repeats an uncertain send',async()=>{
 const nonces:string[]=[];
 const transport=vi.fn(async(_input:unknown,init?:RequestInit)=>{
  nonces.push(new Headers(init?.headers).get('x-cmg-nonce')!);
  return nonces.length===1?new Response(null,{status:429}):Response.json({...payload,status:'sent',sendStarted:true,deliveryConfirmed:true});
 });
 await expect(new SignuDocClient(config,transport as typeof fetch).command({action:'send',...binding,permittedUseConfirmed:true})).resolves.toMatchObject({deliveryConfirmed:true});
 expect(new Set(nonces).size).toBe(2);
 const lost=vi.fn(async()=>{throw Error('Synthetic response lost');});
 await expect(new SignuDocClient(config,lost as typeof fetch).command({action:'send',...binding,permittedUseConfirmed:true})).rejects.toMatchObject({deliveryUncertain:true});expect(lost).toHaveBeenCalledTimes(1);
});
