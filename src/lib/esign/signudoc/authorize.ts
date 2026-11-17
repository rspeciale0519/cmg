import 'server-only';
import {requireStaff} from '@/lib/authz';
import {claimCapabilities} from '@/lib/claims/capabilities';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function authorizeSignuDocClaim(claimId:string){
 const session=await requireStaff();
 if(!uuid.test(claimId))return null;
 const user=await createClient();
 const {data:claim}=await user.from('claims').select('id,claim_ref,status,esign_status,pandadoc_document_id,assigned_adjuster_id').eq('id',claimId).maybeSingle();
 if(!claim||!claimCapabilities({userId:session.userId,role:session.role},{assignedAdjusterId:claim.assigned_adjuster_id}).canManage)return null;
 // Bearer columns are deliberately not granted to authenticated clients.
 // Read them only after RLS and staff capabilities authorize the visible row.
 const {data:protectedClaim,error}=await createAdminClient().from('claims').select('id,claim_ref,status,esign_status,pandadoc_document_id,esign_active_attempt_token,esign_dispatch_token,assigned_adjuster_id').eq('id',claimId).maybeSingle();
 if(error||!protectedClaim||protectedClaim.assigned_adjuster_id!==claim.assigned_adjuster_id||!claimCapabilities({userId:session.userId,role:session.role},{assignedAdjusterId:protectedClaim.assigned_adjuster_id}).canManage)return null;
 return {session,claim:protectedClaim};
}
