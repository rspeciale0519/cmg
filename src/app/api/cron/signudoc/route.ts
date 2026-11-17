import {authorizeCronRequest} from '@/lib/cron/auth';
import {isSurfaceOpen} from '@/lib/site-mode';
import {createAdminClient} from '@/lib/supabase/admin';
import {readSignuDocSettings} from '@/lib/esign/signudoc/config';
import {SignuDocClient} from '@/lib/esign/signudoc/client';
import {sweepSignuDocSigning} from '@/lib/esign/signudoc/sweep';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request:Request):Promise<Response>{
 if(!isSurfaceOpen('/admin'))return new Response(null,{status:404});
 const verdict=authorizeCronRequest(request.headers);
 if(!verdict.ok)return Response.json({ok:false,error:verdict.reason},{status:verdict.status});
 const {config}=readSignuDocSettings();
 if(!config)return Response.json({ok:true,configured:false,selected:0,filed:0,failed:0});
 try{return Response.json({ok:true,configured:true,...await sweepSignuDocSigning(createAdminClient(),new SignuDocClient(config))});}
 catch{return Response.json({ok:false,error:'Signing reconciliation is unavailable.'},{status:503});}
}
export const POST=GET;
