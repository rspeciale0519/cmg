import { describe, expect, it, vi } from "vitest";
import { AirtableClient, AirtableError, sameCells } from "./client";

describe("Airtable transport", () => {
  it("verifies the record through the exact table, never broad Get record", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ records: [{ id: "rec00000000000001", fields: { fld00000000000001: "CMG-2026-0003" } }] }));
    const client = new AirtableClient("synthetic", fetcher);
    await client.readRecord("app00000000000001", "tbl00000000000001", "rec00000000000001", ["fld00000000000001"]);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.pathname).toBe("/v0/app00000000000001/tbl00000000000001");
    expect(url.searchParams.get("filterByFormula")).toBe('RECORD_ID()="rec00000000000001"');
    expect(url.searchParams.get("maxRecords")).toBe("1");
  });
  it("uses PATCH and refuses partial success", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "rec00000000000001", fields: { fld00000000000001: "yes" }, details: { message: "partialSuccess" } }));
    const client = new AirtableClient("synthetic", fetcher);
    await expect(client.update("app00000000000001", "tbl00000000000001", "rec00000000000001", { fld00000000000001: "yes" })).rejects.toMatchObject({ code: "UNCERTAIN" });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(fetcher.mock.calls[0][1].method).toBe("PATCH");
    expect(body.typecast).toBe(false);
    expect(body.returnFieldsByFieldId).toBe(true);
  });
  it("marks a lost write response as uncertain and refuses unsafe identifiers", async () => {
    const client = new AirtableClient("synthetic", vi.fn().mockRejectedValue(new Error("private provider detail")));
    await expect(client.update("app00000000000001", "tbl00000000000001", "rec00000000000001", {})).rejects.toMatchObject({ code: "UNCERTAIN" });
    await expect(client.readRecord("https://elsewhere.test", "tbl00000000000001", "rec00000000000001", [])).rejects.toBeInstanceOf(AirtableError);
  });
  it("compares only requested cells, including Airtable's omitted empty cells", () => {
    expect(sameCells({ fld1: "", fld2: null }, {})).toBe(true);
    expect(sameCells({ fld1: 0 }, { fld1: 0, unrelated: "kept" })).toBe(true);
    expect(sameCells({ fld1: 2 }, { fld1: 3 })).toBe(false);
  });
});
