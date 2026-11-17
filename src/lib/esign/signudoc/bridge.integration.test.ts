// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
vi.mock('server-only',()=>({}));
const {SignuDocClient}=await import('./client');
const {SignuDocProvider}=await import('./provider');
const {signBridgeRequest}=await import('./bridge-auth');
const {buildPrefilledLorPdf}=await import('../lor-prefill');
const manifest=(await import('../lor-tag-manifest.json')).default;
const enabled=process.env.CMG_SIGNUDOC_INTEGRATION==='1';
// Explicit opt-in is checked before any optional environment or filesystem data.
describe.runIf(enabled)('actual CMG contracts through the authenticated local SignuDoc bridge',()=>{
 it('preserves ownership/idempotency, signs one/two homeowners, and returns both verified artifacts',async()=>{
  const origin=process.env.SIGNUDOC_TEST_ORIGIN!;
  const url=new URL(origin);expect(['localhost','127.0.0.1']).toContain(url.hostname);expect(url.protocol).toBe('http:');expect(url.port).toBe('3187');
  const outbox=process.env.SIGNUDOC_TEST_OUTBOX!;expect(path.basename(outbox)).toBe('outbox');
  const config={origin,firmId:'11111111-1111-4111-8111-111111111111',key:'synthetic-bridge-fixture-only-01234567890123456789',allowLocalTest:true};
  const client=new SignuDocClient(config);
  const endpoint=origin+'/api/internal/cmg/v1';
  const post=async(data:Record<string,unknown>,headers?:Headers)=>{
   const body=JSON.stringify(data);return fetch(endpoint,{method:'POST',body,headers:headers??signBridgeRequest({method:'POST',pathname:'/api/internal/cmg/v1',body},config),redirect:'error'});
  };
  const messages=async()=>Promise.all((await readdir(outbox).catch((e:NodeJS.ErrnoException)=>{if(e.code==="ENOENT")return [];throw e;})).filter(x=>x.endsWith('.json')).sort().map(async x=>JSON.parse(await readFile(path.join(outbox,x),'utf8'))));
  const findings=[];
  for(const variant of ['single','dual'] as const){
   const binding={claimId:randomUUID(),attemptToken:randomUUID()};
   expect((await post({action:'status',...binding},new Headers({'content-type':'application/json'}))).status).toBe(401);
   const replayBody=JSON.stringify({action:'status',...binding});
   const replayHeaders=signBridgeRequest({method:'POST',pathname:'/api/internal/cmg/v1',body:replayBody},config);
   expect((await post({action:'status',...binding},replayHeaders)).status).toBe(404);
   expect((await post({action:'status',...binding},replayHeaders)).status).toBe(409);
   expect((await post({action:'status',...binding},signBridgeRequest({method:'POST',pathname:'/api/internal/cmg/v1',body:replayBody},{...config,firmId:randomUUID()}))).status).toBe(401);
   const signers=[{firstName:'Avery',lastName:'Synthetic',email:variant+'-avery@example.invalid',role:'Homeowner1' as const}];
   if(variant==='dual')signers.push({firstName:'Blake',lastName:'Synthetic',email:variant+'-blake@example.invalid',role:'Homeowner2' as 'Homeowner1'});
   const tokens=[{name:'Policyholders.Name',value:signers.map(s=>s.firstName+' '+s.lastName).join(' and ')},{name:'Claim.Carrier',value:'Synthetic Insurance'},{name:'Claim.PolicyNumber',value:'TEST-POLICY'},{name:'Property.Address',value:'100 Synthetic Lane, Example City, FL 00000'},{name:'Fee.Percent',value:'10'}];
   const built=await buildPrefilledLorPdf({signers,tokens},new Date('2026-11-16T12:00:00Z'));
   const pdf=await PDFDocument.load(built),font=await pdf.embedFont(StandardFonts.Helvetica);
   for(const p of pdf.getPages())p.drawText('SYNTHETIC TEST ONLY - NOT AN EXECUTED AGREEMENT',{x:20,y:8,size:7,font,color:rgb(.8,0,0)});
   const bytes=await pdf.save();
   const fields=manifest.variants[variant].signature.map(f=>({role:f.role==='H1'?'Homeowner1':'Homeowner2',type:({s:'signature',i:'initials',d:'date'} as const)[f.type],page:f.page,x:f.x/612,y:(792-f.y-18)/792,width:(f.type==='i'?38:f.type==='d'?74:145)/612,height:18/792,required:!f.optional,label:f.id}));
   const prepare={action:'prepare',...binding,title:'SYNTHETIC actual CMG '+variant,pdfBase64:Buffer.from(bytes).toString('base64'),sourceSha256:createHash('sha256').update(bytes).digest('hex'),signers:signers.map(s=>({role:s.role,name:s.firstName+' '+s.lastName,email:s.email})),fields};
   const concurrent=await Promise.allSettled([client.command(prepare),client.command(prepare)]);
   const accepted=concurrent.filter(r=>r.status==='fulfilled').map(r=>r.value);expect(accepted.length).toBeGreaterThan(0);
   for(const result of concurrent)if(result.status==='rejected')expect(result.reason.httpStatus).toBe(429);
   const first=accepted[0],duplicate=await client.command(prepare);
   expect(first.envelopeId).toBe(duplicate.envelopeId);expect(first.sourceSha256).toBe(prepare.sourceSha256);expect(first.status).toBe('draft');
   expect((await post({...prepare,title:'Changed after review'})).status).toBe(409);
   expect((await post({action:'status',...binding,claimId:randomUUID()})).status).toBe(404);
   expect((await post({action:'status',...binding,userId:'another-owner'})).status).toBe(400);
   const login=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({email:'cmg-admin@example.com',password:'Synthetic-Only-Password-4130!x'})});
   expect(login.status).toBe(200);
   const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
   const senderHeaders={'content-type':'application/json',origin,cookie};
   expect((await fetch(origin+'/api/envelopes/'+first.envelopeId+'/document',{headers:senderHeaders})).status).toBe(200);
   // The normal sender UI must not alter or send the already-reviewed bridge draft.
   const edited=await fetch(origin+'/api/envelopes/'+first.envelopeId+'/signers',{method:'PUT',headers:senderHeaders,body:JSON.stringify({signers:signers.map(s=>({name:'Changed recipient',email:s.email}))})});
   expect(edited.ok).toBe(false);
   const bypass=await fetch(origin+'/api/envelopes/'+first.envelopeId+'/send',{method:'POST',headers:senderHeaders,body:JSON.stringify({permittedUseConfirmed:true})});
   expect(bypass.ok).toBe(false);
   expect((await messages()).filter(m=>m.template==='signing_invitation'&&m.to.includes(signers[0].email))).toHaveLength(0);
   let recordedBeforeSend=false;
   const providerClient=new SignuDocClient(config,async(input,init)=>{
    const response=await fetch(input,init);
    if(variant==='dual'&&JSON.parse(String(init?.body)).action==='send')throw new Error('Synthetic response lost after accepted send');
    return response;
   });
   const dispatch=new SignuDocProvider(providerClient).dispatchLor({claimId:binding.claimId,dispatchAttemptToken:binding.attemptToken,claimRef:'CMG-SYNTHETIC',documentName:prepare.title,signers,tokens,reviewedPdf:bytes,beforeSend:async reference=>{
    expect(reference).toBe('signudoc:'+first.envelopeId);
    expect((await messages()).filter(m=>m.template==='signing_invitation'&&m.to.includes(signers[0].email))).toHaveLength(0);
    recordedBeforeSend=true;
   }});
   if(variant==='dual')await expect(dispatch).rejects.toMatchObject({deliveryUncertain:true});
   else expect((await dispatch).deliveredByProvider).toBe(true);
   expect(recordedBeforeSend).toBe(true);
   const sent=await client.command({action:'status',...binding});expect(sent.deliveryConfirmed).toBe(true);expect(sent.status).toBe('sent');
   await client.command({action:'send',...binding,permittedUseConfirmed:true});
   expect((await messages()).filter(m=>m.template==='signing_invitation'&&m.to.includes(signers[0].email))).toHaveLength(1);
   if(variant==='single'){
    const reminder={action:'remind',...binding,operationId:randomUUID()};
    const reminderResult=await post(reminder);expect(reminderResult.status).toBe(200);
    expect((await post(reminder)).status).toBe(409);
    expect((await messages()).filter(m=>m.template==='manual_nudge'&&m.to.includes(signers[0].email))).toHaveLength(1);
   }
   for(let i=0;i<signers.length;i++){
    let mail;
    for(let n=0;n<100;n++){mail=(await messages()).reverse().find(m=>['signing_invitation','manual_nudge'].includes(m.template)&&m.to.includes(signers[i].email));if(mail)break;await new Promise(r=>setTimeout(r,50));}
    expect(mail).toBeTruthy();
    const link=(mail.text.match(/https?:\/\/[^\s<>"]+/g)||[]).find((u:string)=>new URL(u).pathname.startsWith('/sign/'));
    const token=new URL(link!).pathname.split('/').pop();
    const read=await fetch(origin+'/api/signing/'+token);expect(read.status).toBe(200);const payload=await read.json();
    expect(payload.currentSignerFields.filter((f:{required:boolean})=>f.required)).toHaveLength(9);
    const choose=variant==='dual'&&i===0;
    const answers=payload.currentSignerFields.filter((f:{required:boolean})=>f.required||choose).map((f:{id:string;type:string})=>f.type==='date'?{fieldId:f.id,type:'date',checked:true}:{fieldId:f.id,type:f.type,inputMethod:'typed',value:f.type==='initials'?(i===0?'AS':'BS'):signers[i].firstName+' Synthetic'});
    expect((await fetch(origin+payload.consentUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({disclosureVersion:payload.disclosure.version})})).status).toBe(200);
    expect((await fetch(origin+payload.submitUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientTimezoneOffsetMinutes:300,fields:answers})})).status).toBe(200);
    const state=await client.command({action:'status',...binding});
    expect(state.signers[i].status).toBe('signed');expect(state.status).toBe(i===signers.length-1?'completed':'sent');
    if(i<signers.length-1)expect(state.signers[i+1].status).not.toBe('signed');
   }
   const completed=await client.command({action:'status',...binding});
   for(const artifact of ['signed','evidence'] as const){
    const expected=artifact==='signed'?completed.artifacts.signedSha256:completed.artifacts.evidenceSha256;expect(expected).toBeTruthy();
    const output=await client.download(binding,artifact,expected!);expect(Buffer.from(output.subarray(0,5)).toString()).toBe('%PDF-');
    await expect(client.download(binding,artifact,'f'.repeat(64))).rejects.toThrow();
   }
   expect((await post({action:'remind',...binding,operationId:randomUUID()})).status).toBe(409);
   findings.push({variant,requiredFields:fields.filter(f=>f.required).length,totalFields:fields.length,status:completed.status,signers:completed.signers.map(s=>({role:s.role,status:s.status})),artifacts:completed.artifacts,transport:'actual CMG provider and client to real SignuDoc HTTP, local Postgres, capture-only email',lostSendResponse:variant==='dual'?'locked as uncertain; remote confirmation recovered':'not injected',manualReminder:variant==='single'?'captured once; duplicate refused':'not requested',browserMobile:'deferred',cmgDatabaseWorkflow:'not exercised by this transport test'});
  }
  const {writeFile,mkdir}=await import('node:fs/promises');
  const destination=process.env.SIGNUDOC_TEST_RESULTS!;expect(path.basename(destination)).toBe('bridge-http-results.json');await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,JSON.stringify(findings,null,2)+'\n');
 },120000);
});
