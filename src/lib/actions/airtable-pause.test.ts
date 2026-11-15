// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({owner:vi.fn(),staff:vi.fn(),rpc:vi.fn(),refresh:vi.fn(),fetcher:vi.fn()}));
vi.mock("@/lib/authz",()=>({requireOwner:mocks.owner,requireStaff:mocks.staff}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.refresh}));
import {setAirtableClaimPaused,setAirtableCompanyPaused} from "./airtable-pause";
const id="00000000-0000-4000-8000-000000000001";
function form(key:string,paused:string) {const data=new FormData();data.set(key,id);data.set("paused",paused);return data;}
beforeEach(()=>{vi.resetAllMocks();mocks.owner.mockResolvedValue({userId:id});mocks.staff.mockResolvedValue({userId:id});mocks.rpc.mockResolvedValue({error:null});vi.stubGlobal("fetch",mocks.fetcher);});
afterEach(()=>vi.unstubAllGlobals());
describe("Airtable pause controls",()=>{
  it("pauses the company through its guarded RPC without contacting the provider",async()=>{
    const result=await setAirtableCompanyPaused({status:"idle"},form("companyId","true"));
    expect(result.status).toBe("success");expect(result.message).toContain("already started");
    expect(mocks.owner).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("set_airtable_company_paused",{p_company_id:id,p_paused:true});
    expect(mocks.fetcher).not.toHaveBeenCalled();
  });
  it("resumes claim checks without a provider call or immediate send",async()=>{
    const result=await setAirtableClaimPaused({status:"idle"},form("claimId","false"));
    expect(result.message).toContain("Old updates remain held");
    expect(mocks.staff).toHaveBeenCalledWith("/admin");
    expect(mocks.rpc).toHaveBeenCalledWith("set_airtable_claim_paused",{p_claim_id:id,p_paused:false});
    expect(mocks.fetcher).not.toHaveBeenCalled();
  });
  it("refuses invalid intent and keeps database refusals generic",async()=>{
    expect((await setAirtableCompanyPaused({status:"idle"},form("companyId","unexpected"))).status).toBe("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({error:{message:"Private database detail"}});
    const result=await setAirtableClaimPaused({status:"idle"},form("claimId","true"));
    expect(result.status).toBe("error");expect(result.message).not.toContain("Private");
  });
  it("does not mutate anything when the Owner check refuses",async()=>{
    mocks.owner.mockRejectedValueOnce(new Error("Not found"));
    await expect(setAirtableCompanyPaused({status:"idle"},form("companyId","true"))).rejects.toThrow("Not found");
    expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.fetcher).not.toHaveBeenCalled();
  });
});
