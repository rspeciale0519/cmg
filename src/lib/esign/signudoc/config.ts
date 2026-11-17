import 'server-only';
import {SignuDocClient,type SignuDocConfig} from './client';
export type SignuDocSettings={enabled:boolean;config:SignuDocConfig|null;blocker:string|null};
export function readSignuDocSettings():SignuDocSettings{
 const enabled=process.env.SIGNUDOC_ENABLED==='1';
 const config:SignuDocConfig={origin:process.env.SIGNUDOC_SERVICE_ORIGIN?.trim()??'',firmId:process.env.SIGNUDOC_FIRM_ID?.trim()??'',key:process.env.SIGNUDOC_BRIDGE_KEY??'',allowLocalTest:process.env.SIGNUDOC_ALLOW_LOCAL_TEST==='1'&&process.env.VERCEL!=='1'};
 try{new SignuDocClient(config);return {enabled,config,blocker:null};}
 catch{return {enabled,config:null,blocker:enabled?'The experimental signing service is not configured. Contact the administrator.':null};}
}
