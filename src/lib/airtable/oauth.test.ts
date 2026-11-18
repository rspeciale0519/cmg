// @vitest-environment node
import { describe,it,expect,vi,beforeEach,afterEach } from "vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),adminRpc:vi.fn(),fetcher:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:mocks.adminRpc})}));
vi.mock("./config",()=>({airtableConfig:()=>({clientId:"synthetic-client",clientSecret:"synthetic-secret",key:Buffer.alloc(32,1).toString("base64"),redirectUri:"https://example.test/api/integrations/airtable/callback"})}));
import {beginOAuth,finishOAuth,requestTokens,accessToken} from "./oauth";
import {sealSecret} from "./crypto";
const company="00000000-0000-4000-8000-000000000001",owner="00000000-0000-4000-8000-000000000002";
const pair={access_token:"synthetic-access",refresh_token:"synthetic-refresh",expires_in:3600,scope:"data.records:read data.records:write schema.bases:read"};
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("fetch",mocks.fetcher);});
afterEach(()=>vi.unstubAllGlobals());
describe("Airtable scoped OAuth",()=>{
  it("creates one owner-bound encrypted state with PKCE and fixed callback",async()=>{
    mocks.rpc.mockResolvedValue({error:null});
    const url=new URL(await beginOAuth(company,owner));
    expect(url.origin).toBe("https://airtable.com"); expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.test/api/integrations/airtable/callback");
    expect(url.searchParams.get("state")).toHaveLength(43);
    const stored=mocks.rpc.mock.calls[0][1];
    expect(stored.p_state_hash).toMatch(/^[a-f0-9]{64}$/);expect(stored.p_ciphertext).not.toContain(url.searchParams.get("state"));
    expect(stored.p_company_id).toBe(company);
  });
  it("refuses reused or wrong-owner state before token exchange",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:null});
    await expect(finishOAuth("a".repeat(43),"synthetic-code",owner)).rejects.toThrow("AIRTABLE_CALLBACK_INVALID");
    expect(mocks.fetcher).not.toHaveBeenCalled();
  });
  it("requires every approved scope and exposes no provider error body",async()=>{
    mocks.fetcher.mockResolvedValueOnce(Response.json({...pair,scope:"data.records:read"}));
    await expect(requestTokens({grant_type:"authorization_code",code:"synthetic"})).rejects.toThrow("AIRTABLE_RECONNECT_REQUIRED");
    expect(mocks.fetcher.mock.calls[0][1].redirect).toBe("error");
    expect(mocks.fetcher.mock.calls[0][1].headers.Authorization).toBe(`Basic ${Buffer.from("synthetic-client:synthetic-secret").toString("base64url")}`);
  });
  it("replaces invalid token JSON with a fixed safe error",async()=>{
    mocks.fetcher.mockResolvedValueOnce(new Response("invalid private provider response"));
    await expect(requestTokens({grant_type:"authorization_code",code:"synthetic"})).rejects.toThrow("AIRTABLE_RECONNECT_REQUIRED");
  });
  it("does not repeat refresh after an uncertain response",async()=>{
    const ciphertext=sealSecret(JSON.stringify(pair),`tokens:${company}`,Buffer.alloc(32,1).toString("base64"));
    mocks.adminRpc.mockResolvedValueOnce({data:{ciphertext,refresh:true,leaseToken:owner,version:3},error:null}).mockResolvedValue({data:true,error:null});
    mocks.fetcher.mockRejectedValueOnce(new Error("private provider detail"));
    await expect(accessToken(company,company)).rejects.toThrow("AIRTABLE_RECONNECT_REQUIRED");
    expect(mocks.fetcher).toHaveBeenCalledTimes(1);
    expect(mocks.adminRpc.mock.calls[1][1]).toMatchObject({p_ok:false,p_version:3,p_lease_token:owner});
  });
});
