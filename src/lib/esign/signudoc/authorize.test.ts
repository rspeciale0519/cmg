import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({session:vi.fn(),query:vi.fn(),client:vi.fn(),admin:vi.fn(),privileged:vi.fn(),select:vi.fn()}));
vi.mock('@/lib/authz',()=>({requireStaff:mocks.session}));
vi.mock('@/lib/supabase/server',()=>({createClient:mocks.client}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:mocks.admin}));
const {authorizeSignuDocClaim}=await import('./authorize');
const id='11111111-1111-4111-8111-111111111111',actor='22222222-2222-4222-8222-222222222222';
beforeEach(()=>{
 vi.clearAllMocks();
 mocks.client.mockResolvedValue({from:()=>({select:(columns:string)=>{
  mocks.select(columns);
  if(/esign_(active_attempt|dispatch)_token/.test(columns))return {eq:()=>({maybeSingle:async()=>({data:null,error:{message:'permission denied'}})})};
  return {eq:()=>({maybeSingle:mocks.query})};
 }})});
 mocks.admin.mockReturnValue({from:()=>({select:()=>({eq:()=>({maybeSingle:mocks.privileged})})})});
 mocks.privileged.mockResolvedValue({data:{id,assigned_adjuster_id:actor,esign_active_attempt_token:'test-token',esign_dispatch_token:null},error:null});
 mocks.query.mockResolvedValue({data:{id,assigned_adjuster_id:actor}});
});
it('permits only the owner or assigned adjuster after staff/MFA authorization',async()=>{
 for(const role of ['owner','adjuster']){mocks.session.mockResolvedValue({userId:actor,role,aal:'aal2'});expect(await authorizeSignuDocClaim(id)).not.toBeNull();}
 mocks.session.mockResolvedValue({userId:actor,role:'assistant',aal:'aal2'});expect(await authorizeSignuDocClaim(id)).toBeNull();
 mocks.session.mockResolvedValue({userId:'other',role:'adjuster',aal:'aal2'});expect(await authorizeSignuDocClaim(id)).toBeNull();
});
it('does not distinguish invisible claims and refuses malformed IDs before querying',async()=>{
 mocks.session.mockResolvedValue({userId:actor,role:'owner',aal:'aal2'});mocks.query.mockResolvedValue({data:null});expect(await authorizeSignuDocClaim(id)).toBeNull();
 mocks.query.mockClear();expect(await authorizeSignuDocClaim('not-a-uuid')).toBeNull();expect(mocks.query).not.toHaveBeenCalled();
});

it('reads bearer columns only after user-scoped capability authorization',async()=>{mocks.session.mockResolvedValue({userId:actor,role:'owner',aal:'aal2'});const result=await authorizeSignuDocClaim(id);expect(result?.claim.esign_active_attempt_token).toBe('test-token');expect(mocks.select.mock.calls.every(c=>!/esign_(active_attempt|dispatch)_token/.test(c[0]))).toBe(true);mocks.query.mockResolvedValue({data:null});mocks.admin.mockClear();expect(await authorizeSignuDocClaim(id)).toBeNull();expect(mocks.admin).not.toHaveBeenCalled();});
