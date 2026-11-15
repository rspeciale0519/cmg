// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { deliverOne, type DeliveryStore, type ReadyDelivery } from "./delivery";

const lease={id:"00000000-0000-4000-8000-000000000001",leaseToken:"00000000-0000-4000-8000-000000000002",uncertain:false};
const reference="fld00000000000001",stage="fld00000000000002",record="rec00000000000001";
const work:ReadyDelivery={request:{id:lease.id,claim_id:lease.id,connection_id:lease.id,record_id:record,
  selected_fields:["claim_ref","status"],source_values:{claim_ref:"CMG-SYNTHETIC",status:"filed"},reviewed:false},
  connection:{id:lease.id,company_id:lease.id,base_id:"app00000000000001",table_id:"tbl00000000000001",
    mappings:[{source:"claim_ref",fieldId:reference,fieldType:"singleLineText"},{source:"status",fieldId:stage,fieldType:"singleLineText"}]},
  lastValues:{[reference]:"CMG-SYNTHETIC",[stage]:"documenting"}};
const schema={tables:[{id:work.connection.table_id,fields:[{id:reference,name:"CMG claim",type:"singleLineText"},{id:stage,name:"CMG stage",type:"singleLineText"}]}]};
function setup(actual:Record<string,unknown>=work.lastValues) {
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(schema))
    .mockResolvedValueOnce(Response.json({records:[{id:record,fields:actual}]}))
    .mockResolvedValueOnce(Response.json({id:record,fields:{[reference]:"CMG-SYNTHETIC",[stage]:"filed"}}));
  const store:DeliveryStore={ready:vi.fn().mockResolvedValue(work),settle:vi.fn().mockResolvedValue(undefined),
    token:vi.fn().mockResolvedValue("synthetic-only"),pace:vi.fn().mockResolvedValue(undefined)};
  return {fetcher,store};
}
describe("Airtable durable delivery",()=>{
  it("writes only the mapped columns after current authority and source checks",async()=>{
    const {store,fetcher}=setup();
    expect(await deliverOne(lease,store,fetcher)).toBe("sent");
    expect(store.ready).toHaveBeenNthCalledWith(2,lease,false);
    expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body))).toEqual({fields:{[reference]:"CMG-SYNTHETIC",[stage]:"filed"},typecast:false,returnFieldsByFieldId:true});
    expect(store.settle).toHaveBeenCalledWith(lease,"sent",{[reference]:"CMG-SYNTHETIC",[stage]:"filed"},null);
  });
  it("reconciles an already applied uncertain result without another write",async()=>{
    const {store,fetcher}=setup({[reference]:"CMG-SYNTHETIC",[stage]:"filed"});
    expect(await deliverOne({...lease,uncertain:true},store,fetcher)).toBe("sent");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("does not replay an old uncertain snapshot after its source changed",async()=>{
    const {store,fetcher}=setup();
    vi.mocked(store.ready).mockResolvedValueOnce(work).mockResolvedValueOnce(null);
    expect(await deliverOne({...lease,uncertain:true},store,fetcher)).toBe("superseded");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.settle).toHaveBeenCalledWith({...lease,uncertain:true},"superseded",{},"SOURCE_CHANGED");
  });
  it.each([{[reference]:"OTHER-CLAIM",[stage]:"documenting"},{[reference]:"CMG-SYNTHETIC",[stage]:"external edit"}])("stops on wrong identity or unexpected reserved-cell changes",async(actual)=>{
    const {store,fetcher}=setup(actual);
    expect(await deliverOne(lease,store,fetcher)).toBe("review_required");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("retains an uncertain write result instead of reporting success",async()=>{
    const {store,fetcher}=setup(); fetcher.mockReset().mockResolvedValueOnce(Response.json(schema))
      .mockResolvedValueOnce(Response.json({records:[{id:record,fields:work.lastValues}]})).mockRejectedValueOnce(new Error("connection dropped"));
    expect(await deliverOne(lease,store,fetcher)).toBe("uncertain");
    expect(store.settle).toHaveBeenCalledWith(lease,"uncertain",{},"UNCERTAIN");
  });
  it("refuses a revoked claim before reading Airtable",async()=>{
    const {store,fetcher}=setup(); vi.mocked(store.ready).mockResolvedValue(null);
    expect(await deliverOne(lease,store,fetcher)).toBe("review_required"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("rechecks authority after waiting for the final rate slot",async()=>{
    const {store,fetcher}=setup(); let calls=0;
    vi.mocked(store.pace).mockImplementation(async()=>{if(++calls===3) vi.mocked(store.ready).mockResolvedValue(null);});
    expect(await deliverOne(lease,store,fetcher)).toBe("superseded");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("keeps an uncertain read failure uncertain",async()=>{
    const {store,fetcher}=setup(); fetcher.mockReset().mockResolvedValueOnce(new Response("",{status:429}));
    expect(await deliverOne({...lease,uncertain:true},store,fetcher)).toBe("uncertain");
  });
  it("does not release the ambiguous barrier when access or configuration is unavailable",async()=>{
    const {store,fetcher}=setup();vi.mocked(store.ready).mockResolvedValue(null);
    expect(await deliverOne({...lease,uncertain:true},store,fetcher)).toBe("uncertain");
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.settle).toHaveBeenCalledWith({...lease,uncertain:true},"uncertain",{},"AUTHORITY_CHANGED");
  });
});
