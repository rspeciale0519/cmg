// @vitest-environment node
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({settings:vi.fn(),admin:vi.fn(),sweep:vi.fn()}));
vi.mock('@/lib/esign/signudoc/config',()=>({readSignuDocSettings:m.settings}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:m.admin}));
vi.mock('@/lib/esign/signudoc/sweep',()=>({sweepSignuDocSigning:m.sweep}));
const {GET}=await import('./route');
const key='synthetic-cron-test-key-only-01234567890123456789';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('SITE_MODE','staff');vi.stubEnv('CRON_SECRET',key);m.settings.mockReturnValue({enabled:false,config:null});m.admin.mockReturnValue({});m.sweep.mockResolvedValue({selected:2,filed:1,failed:0});});
afterEach(()=>vi.unstubAllEnvs());
const request=(authorized=true)=>new Request('http://localhost/api/cron/signudoc',{headers:authorized?{authorization:'Bearer '+key}:{}});
it('closes simple mode and refuses unauthenticated calls before privileged work',async()=>{
 expect((await GET(request(false))).status).toBe(401);expect(m.admin).not.toHaveBeenCalled();vi.stubEnv('SITE_MODE','simple');expect((await GET(request())).status).toBe(404);expect(m.sweep).not.toHaveBeenCalled();
});
it('does nothing when the signing service is unconfigured',async()=>{
 const response=await GET(request());expect(response.status).toBe(200);expect(await response.json()).toMatchObject({configured:false,selected:0});expect(m.admin).not.toHaveBeenCalled();
});
it('can reconcile old in-flight requests while new SignuDoc sends are switched off',async()=>{
 m.settings.mockReturnValue({enabled:false,config:{origin:'https://sign.example.invalid',firmId:'11111111-1111-4111-8111-111111111111',key:'synthetic-bridge-fixture-only-01234567890123456789'}});const response=await GET(request());expect(response.status).toBe(200);expect(await response.json()).toMatchObject({selected:2,filed:1});expect(m.sweep).toHaveBeenCalledOnce();
});
