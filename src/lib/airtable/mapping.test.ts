import { describe, expect, it } from "vitest";
import { mapFields, validateMappings, selectAutomaticFields } from "./mapping";

const mappings = [
  { source: "claim_ref", fieldId: "fld00000000000001", fieldType: "singleLineText" },
  { source: "status", fieldId: "fld00000000000002", fieldType: "singleSelect", choices: { negotiating: "Negotiating" } },
  { source: "settlement_amount", fieldId: "fld00000000000003", fieldType: "currency" },
] as const;

describe("Airtable mapping boundary", () => {
  it("maps only selected nonempty values and never coerces missing choices", () => {
    expect(mapFields({ claim_ref: "CMG-2026-0003", status: "negotiating", settlement_amount: 1200 }, mappings, ["claim_ref", "status"]))
      .toEqual({ fld00000000000001: "CMG-2026-0003", fld00000000000002: "Negotiating" });
    expect(() => mapFields({ status: "denied" }, mappings, ["status"])).toThrow("MAPPING_INVALID");
    expect(mapFields({ settlement_amount: null }, mappings, ["settlement_amount"])).toEqual({});
  });
  it("refuses private fields, duplicate cells, missing identity, and incompatible schema", () => {
    const schema = mappings.map(m => ({ id: m.fieldId, type: m.fieldType, options: { choices: [{ name: "Negotiating" }] } }));
    expect(validateMappings(mappings, schema)).toEqual(mappings);
    expect(() => validateMappings([{ source: "policy_secret", fieldId: "fld00000000000001", fieldType: "singleLineText" }], schema)).toThrow();
    expect(() => validateMappings(mappings.slice(1), schema)).toThrow();
    expect(() => validateMappings([...mappings, { ...mappings[0], source: "carrier" }], schema)).toThrow();
    expect(() => validateMappings(mappings, schema.map(f => ({ ...f, type: "formula" })))).toThrow();
  });
  it("keeps monetary and message fields held in milestone mode", () => {
    expect(selectAutomaticFields("milestones", ["claim_ref", "status", "settled_at", "settlement_amount", "messages"]))
      .toEqual(["claim_ref", "status", "settled_at"]);
    expect(selectAutomaticFields("manual", ["status"])).toEqual([]);
  });
  it("keeps full message history, refuses truncation, and requires review for clearing",()=>{
    const messageMapping=[{source:"messages",fieldId:"fld00000000000004",fieldType:"multilineText"}] as const;
    const history="2026-11-15 09:00 UTC\nFirst message\n\n2026-11-15 10:00 UTC\nSecond message";
    expect(mapFields({messages:history},messageMapping,["messages"])).toEqual({fld00000000000004:history});
    expect(()=>mapFields({messages:"x".repeat(90001)},messageMapping,["messages"])).toThrow("FIELD_TOO_LONG");
    expect(mapFields({messages:null},messageMapping,["messages"],true)).toEqual({fld00000000000004:null});
  });
  it("converts dates to the configured date precision",()=>{
    expect(mapFields({filed_at:"2026-11-15T12:20:30.000Z"},[{source:"filed_at",fieldId:"fld00000000000005",fieldType:"date"}],["filed_at"]))
      .toEqual({fld00000000000005:"2026-11-15"});
  });
  it.each([['homeowner_name','date'],['carrier','email'],['property_address','phoneNumber'],['adjuster_name','singleSelect']] as const)("refuses incompatible %s to %s mappings before saving",(source,fieldType)=>{
    const invalid={source,fieldId:"fld00000000000006",fieldType,choices:{test:"Existing"}};
    const schema=[{id:mappings[0].fieldId,type:"singleLineText"},{id:invalid.fieldId,type:fieldType,options:{choices:[{name:"Existing"}]}}];
    expect(()=>validateMappings([mappings[0],invalid],schema)).toThrow("MAPPING_INVALID");
  });
  it("allows matching specialized columns and plain text representations",()=>{
    const valid=[mappings[0],{source:"homeowner_email",fieldId:"fld00000000000006",fieldType:"email"},
      {source:"homeowner_phone",fieldId:"fld00000000000007",fieldType:"phoneNumber"},
      {source:"loss_date",fieldId:"fld00000000000008",fieldType:"date"},
      {source:"legal_date",fieldId:"fld00000000000009",fieldType:"singleLineText"}] as const;
    expect(validateMappings(valid,valid.map(m=>({id:m.fieldId,type:m.fieldType})))).toEqual(valid);
  });
});
