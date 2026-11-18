import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { AirtableCompanyForm } from "./airtable-company-form";
import { AirtableLinkForm, AirtableMessageForm, AirtableReviewForm } from "./airtable-claim-forms";
import type { ConnectionView, DeliveryView } from "@/lib/airtable/parse";

const actions=vi.hoisted(()=>({connect:vi.fn(),inspectSetup:vi.fn(),saveCompany:vi.fn(),inspectRecord:vi.fn(),saveClaim:vi.fn(),message:vi.fn(),review:vi.fn(),prepare:vi.fn()}));
vi.mock("@/lib/actions/airtable",()=>({connectAirtable:actions.connect,inspectAirtableSetup:actions.inspectSetup,saveAirtableCompany:actions.saveCompany,
  inspectAirtableRecord:actions.inspectRecord,saveAirtableClaim:actions.saveClaim,addAirtableMessage:actions.message,reviewAirtableUpdate:actions.review,prepareAirtableReview:actions.prepare}));
vi.mock("@/lib/actions/airtable-pause",()=>({setAirtableCompanyPaused:async()=>({status:"success"}),setAirtableClaimPaused:async()=>({status:"success"})}));
const companyId="00000000-0000-4000-8000-000000000001";
const connection:ConnectionView={id:companyId,company_id:companyId,base_id:"app00000000000001",table_id:"tbl00000000000001",
  mappings:[{source:"claim_ref",fieldId:"fld00000000000001",fieldType:"singleLineText"},{source:"status",fieldId:"fld00000000000002",fieldType:"singleLineText"}],
  default_fields:["claim_ref","status"],default_mode:"manual",enabled:true,config_revision:1,needs_reconnect:false};
const fields=[{id:"fld00000000000001",name:"CMG reference",type:"singleLineText"},{id:"fld00000000000002",name:"Old stage",type:"singleLineText"},{id:"fld00000000000003",name:"New stage",type:"singleLineText"},
  {id:"fld00000000000004",name:"Date column",type:"date"},{id:"fld00000000000005",name:"Email column",type:"email"}];
async function submitButton(label:string) {const button=screen.getByText(label,{selector:"button"});await act(async()=>{fireEvent.submit(button.closest("form")!);});}
beforeEach(()=>{
  vi.resetAllMocks();
  actions.inspectSetup.mockResolvedValue({status:"success",message:"Columns loaded.",fields});
  actions.saveCompany.mockResolvedValue({status:"error",message:"Company save refused."});
  actions.saveClaim.mockResolvedValue({status:"error",message:"Claim save refused."});
  actions.inspectRecord.mockResolvedValue({status:"success",message:"Record checked.",proof:"synthetic-proof",recordId:"rec00000000000001",cells:{}});
  actions.message.mockResolvedValue({status:"error",message:"Message refused."});
});
afterEach(cleanup);
describe("Airtable action reset handling",()=>{
  it("uses plain review labels without changing the outbound snapshot",()=>{
    const request:DeliveryView={id:companyId,digest:"synthetic",status:"held",selected_fields:["claim_ref","status","cause","legal_milestone"],
      source_values:{claim_ref:"CMG-SYNTHETIC",status:"with_law_firm",cause:"wind_hail",legal_milestone:"lawsuit_filed"},attempts:0,created_at:"2026-11-15T00:00:00Z",sent_at:null,last_error:null};
    render(<AirtableReviewForm claimId={companyId} request={request} available/>);
    expect(screen.getByText("With law firm")).toBeDefined();expect(screen.getByText("Wind & hail")).toBeDefined();
    expect(screen.getByText("Lawsuit filed")).toBeDefined();expect(screen.queryByText("with_law_firm")).toBeNull();
    expect(request.source_values.status).toBe("with_law_firm");
  });
  it("keeps visible mappings and submitted settings aligned after a refused save",async()=>{
    render(<AirtableCompanyForm companyId={companyId} connection={connection} available/>);
    await submitButton("Load its columns");
    await screen.findByText("Columns loaded.");
    const table=screen.getByLabelText("Existing deals table") as HTMLSelectElement;
    expect(table.value).toBe(connection.table_id);
    const mapping=screen.getByLabelText("Claim stage") as HTMLSelectElement;
    expect(Array.from((screen.getByLabelText("Homeowner name") as HTMLSelectElement).options).map(option=>option.value)).not.toContain("fld00000000000004");
    expect(Array.from((screen.getByLabelText("Insurance company") as HTMLSelectElement).options).map(option=>option.value)).not.toContain("fld00000000000005");
    const form=screen.getByText("Save reviewed settings",{selector:"button"}).closest("form")!;
    const shared=form.querySelector<HTMLInputElement>('input[name="fields"][value="status"]')!;
    const mode=screen.getByLabelText("Default sending rule");
    act(()=>{
      fireEvent.change(mapping,{target:{value:"fld00000000000003"}});
      fireEvent.click(shared);
      fireEvent.change(mode,{target:{value:"automatic"}});
      fireEvent.click(form.querySelector<HTMLInputElement>('input[name="enabled"]')!);
      fireEvent.click(form.querySelector<HTMLInputElement>('input[name="reserved"]')!);
    });
    await act(async()=>{fireEvent.submit(form);});
    await screen.findByText("Company save refused.");
    expect(mapping.value).toBe("fld00000000000003");
    expect(shared.checked).toBe(false);
    expect((screen.getByLabelText("Default sending rule") as HTMLSelectElement).value).toBe("automatic");
    expect(form.querySelector<HTMLInputElement>('input[name="enabled"]')!.checked).toBe(false);
    expect(JSON.parse(String(new FormData(form).get("mappings"))).find((entry:{source:string})=>entry.source==="status").fieldId).toBe(mapping.value);
    expect(new FormData(form).getAll("fields")).toEqual(["claim_ref"]);
  });
  it("retains record and claim choices after refused actions",async()=>{
    render(<AirtableLinkForm claimId={companyId} connection={connection} link={null} available/>);
    const input=screen.getByLabelText(/Airtable record number/) as HTMLInputElement;
    fireEvent.change(input,{target:{value:"rec00000000000001"}});
    await submitButton("Check existing record");await screen.findByText("Record checked.");
    const form=screen.getByText("Confirm record and sharing",{selector:"button"}).closest("form")!;
    fireEvent.click(form.querySelector<HTMLInputElement>('input[name="fields"][value="status"]')!);
    fireEvent.change(screen.getByLabelText("Sending rule for this claim"),{target:{value:"milestones"}});
    fireEvent.click(form.querySelector<HTMLInputElement>('input[name="enabled"]')!);
    fireEvent.click(form.querySelector<HTMLInputElement>('input[name="confirmed"]')!);
    await act(async()=>{fireEvent.submit(form);});await screen.findByText("Claim save refused.");
    expect(new FormData(form).getAll("fields")).toEqual(["claim_ref"]);
    expect(new FormData(form).get("mode")).toBe("milestones");
    expect(new FormData(form).has("enabled")).toBe(false);
    expect(input.value).toBe("rec00000000000001");
    actions.inspectRecord.mockResolvedValueOnce({status:"success",message:"Other record checked.",proof:"different-proof",recordId:"rec00000000000002",cells:{}});
    fireEvent.change(input,{target:{value:"rec00000000000002"}});await submitButton("Check existing record");
    const fresh=screen.getByText("Confirm record and sharing",{selector:"button"}).closest("form")!;
    expect(fresh.querySelector<HTMLInputElement>('input[name="confirmed"]')!.checked).toBe(false);
  });
  it("retains a refused shared message and clears only a successful message",async()=>{
    render(<AirtableMessageForm claimId={companyId} requestId={companyId} available/>);
    const body=screen.getByLabelText(/Message for the referring company/) as HTMLTextAreaElement;
    const confirm=screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.change(body,{target:{value:"Keep this unsent draft."}});fireEvent.click(confirm);
    await submitButton("Record shared message");await screen.findByText("Message refused.");
    expect(body.value).toBe("Keep this unsent draft.");expect(confirm.checked).toBe(true);
    actions.message.mockResolvedValueOnce({status:"success",message:"Message recorded."});
    await submitButton("Record shared message");await screen.findByText("Message recorded.");
    await waitFor(()=>expect(body.value).toBe(""));expect(confirm.checked).toBe(false);
  });
});
