import {beforeEach,afterEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
const {createESignProvider,esignCapabilities}=await import('./provider');
const {readESignConfig}=await import('./config');
beforeEach(()=>{for(const name of ['SIGNUDOC_ENABLED','SIGNUDOC_SERVICE_ORIGIN','SIGNUDOC_FIRM_ID','SIGNUDOC_BRIDGE_KEY','SIGNUDOC_ALLOW_LOCAL_TEST','PANDADOC_API_KEY'])vi.stubEnv(name,'');});
afterEach(()=>vi.unstubAllEnvs());
function enable(){vi.stubEnv('SIGNUDOC_ENABLED','1');vi.stubEnv('SIGNUDOC_SERVICE_ORIGIN','https://sign.example.invalid');vi.stubEnv('SIGNUDOC_FIRM_ID','11111111-1111-4111-8111-111111111111');vi.stubEnv('SIGNUDOC_BRIDGE_KEY','synthetic-bridge-fixture-only-01234567890123456789');}
it('preserves manual/PandaDoc defaults until SignuDoc is explicitly enabled',()=>{expect(createESignProvider().kind).toBe('manual');vi.stubEnv('PANDADOC_API_KEY','synthetic-panda-key');expect(createESignProvider().kind).toBe('pandadoc');});
it('enables SignuDoc only with complete server configuration',()=>{enable();expect(createESignProvider().kind).toBe('signudoc');expect(esignCapabilities().ready).toBe(true);expect(readESignConfig().signudoc?.config?.key).toBeTruthy();});
it('fails closed on an explicitly selected but unconfigured signing service',()=>{vi.stubEnv('SIGNUDOC_ENABLED','1');vi.stubEnv('PANDADOC_API_KEY','synthetic-panda-key');expect(createESignProvider().kind).toBe('signudoc');expect(esignCapabilities()).toMatchObject({mode:'signudoc',ready:false});});
it('keeps the explicit PandaDoc callback transport when new sends use SignuDoc',()=>{enable();vi.stubEnv('PANDADOC_API_KEY','synthetic-panda-key');expect(createESignProvider({forcePandaDoc:true}).kind).toBe('pandadoc');});
