import 'server-only';
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database-app';
import type {SignuDocClient} from './client';
import {reconcileSignuDocClaim} from './reconcile';
const row=z.object({id:z.uuid(),claim_ref:z.string().min(1),status:z.enum(['under_review','lor_sent']),esign_status:z.string().nullable(),pandadoc_document_id:z.string().regex(/^signudoc:[a-f0-9-]{36}$/),esign_active_attempt_token:z.uuid(),esign_dispatch_token:z.uuid().nullable()});
export async function sweepSignuDocSigning(admin:SupabaseClient<Database>,client:SignuDocClient){
 const batch=await admin.rpc('claim_signudoc_poll_batch',{p_limit:4,p_lease_seconds:600});
 if(batch.error)throw new Error('Signing batch is unavailable.');
 const claims=z.array(row).max(4).parse(batch.data);
 let filed=0,failed=0;
 // Two jobs at a time; leases prevent overlapping cron runs claiming them again.
 for(let offset=0;offset<claims.length;offset+=2){
  const results=await Promise.allSettled(claims.slice(offset,offset+2).map(claim=>reconcileSignuDocClaim(claim,{admin,client})));
  for(const result of results)if(result.status==='rejected')failed++;else if(result.value.filed)filed++;
 }
 return {selected:claims.length,filed,failed};
}
