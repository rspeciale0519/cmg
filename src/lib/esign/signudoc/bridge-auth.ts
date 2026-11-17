import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';

export type BridgeIdentity = {firmId:string;key:string};
export type BridgeRequest = {method:string;pathname:string;body:string;headers:Headers};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function message(input:Omit<BridgeRequest,'headers'>,firm:string,time:string,nonce:string){
 return ['cmg-signudoc-v1',firm,time,nonce,input.method.toUpperCase(),input.pathname,createHash('sha256').update(input.body).digest('hex')].join('\n');
}
export function signBridgeRequest(input:Omit<BridgeRequest,'headers'>,identity:BridgeIdentity,now=Date.now(),nonce=randomUUID()):Headers {
 if(identity.key.trim().length<32||!UUID.test(identity.firmId)||!UUID.test(nonce))throw Error('Invalid bridge configuration');
 const time=String(Math.floor(now/1000));
 const signature=createHmac('sha256',identity.key).update(message(input,identity.firmId,time,nonce)).digest('hex');
 return new Headers({'content-type':'application/json','x-cmg-firm':identity.firmId,'x-cmg-time':time,'x-cmg-nonce':nonce,'x-cmg-signature':signature});
}
/** Authentication only. Caller must atomically consume the returned nonce. */
export function verifyBridgeRequest(input:BridgeRequest,identity:BridgeIdentity,now=Date.now()):string|null {
 const firm=input.headers.get('x-cmg-firm'),time=input.headers.get('x-cmg-time'),nonce=input.headers.get('x-cmg-nonce'),signature=input.headers.get('x-cmg-signature');
 if(identity.key.trim().length<32||firm!==identity.firmId||!UUID.test(identity.firmId)||!time||!/^\d{10}$/.test(time)||!nonce||!UUID.test(nonce)||!signature||!/^[a-f0-9]{64}$/.test(signature))return null;
 const age=now-Number(time)*1000;
 if(age>300000||age < -30000)return null;
 const expected=createHmac('sha256',identity.key).update(message(input,firm,time,nonce)).digest();
 return timingSafeEqual(expected,Buffer.from(signature,'hex'))?nonce:null;
}
