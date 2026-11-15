import { z } from "zod";
import { providerId } from "./mapping";
import type { AirtableFields, SchemaField } from "./fields";

export type AirtableErrorCode = "ACCESS_LOST" | "RATE_LIMIT" | "NOT_FOUND" | "SCHEMA_CHANGED" | "PROVIDER_FAILED" | "UNCERTAIN" | "INVALID_INPUT";
export class AirtableError extends Error {
  constructor(public readonly code: AirtableErrorCode) { super(code); this.name = "AirtableError"; }
}
const recordSchema = z.object({ id: providerId("rec"), fields: z.record(z.string(), z.unknown()), details: z.unknown().optional() });
function checkId(value: string, prefix: string) { if (!providerId(prefix).safeParse(value).success) throw new AirtableError("INVALID_INPUT"); }
const empty = (value: unknown) => value === undefined || value === null || value === "";
export function sameCells(expected: AirtableFields, actual: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([id, value]) => empty(value) ? empty(actual[id]) : actual[id] === value);
}

/** No caller-controlled host or provider error body may leave this boundary. */
export class AirtableClient {
  constructor(private readonly token: string, private readonly fetcher: typeof fetch = fetch) {}
  private async request(path: string, init: RequestInit = {}, writing = false): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(`https://api.airtable.com/v0/${path}`, {
        ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000),
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...init.headers },
      });
    } catch { throw new AirtableError(writing ? "UNCERTAIN" : "PROVIDER_FAILED"); }
    if (response.status === 401 || response.status === 403) throw new AirtableError("ACCESS_LOST");
    if (response.status === 429) throw new AirtableError("RATE_LIMIT");
    if (response.status === 404) throw new AirtableError("NOT_FOUND");
    if (!response.ok) throw new AirtableError(writing && response.status >= 500 ? "UNCERTAIN" : "PROVIDER_FAILED");
    try { return await response.json(); } catch { throw new AirtableError(writing ? "UNCERTAIN" : "PROVIDER_FAILED"); }
  }
  async bases(): Promise<{ id: string; name: string }[]> {
    const bases: { id: string; name: string }[] = [];
    let offset: string | undefined;
    do {
      const query = offset ? `?${new URLSearchParams({ offset })}` : "";
      const page = z.object({ bases: z.array(z.object({ id: providerId("app"), name: z.string() })), offset: z.string().optional() })
        .parse(await this.request(`meta/bases${query}`));
      bases.push(...page.bases); offset = page.offset;
      if (bases.length > 1000) throw new AirtableError("INVALID_INPUT");
    } while (offset);
    return bases;
  }
  async tables(baseId: string): Promise<{ id: string; name: string }[]> {
    checkId(baseId,"app");
    return z.object({ tables: z.array(z.object({ id: providerId("tbl"), name: z.string() })) })
      .parse(await this.request(`meta/bases/${baseId}/tables`)).tables;
  }
  async schema(baseId: string, tableId: string): Promise<SchemaField[]> {
    checkId(baseId, "app"); checkId(tableId, "tbl");
    const parsed = z.object({ tables: z.array(z.object({ id: z.string(), fields: z.array(z.object({
      id: z.string(), name: z.string(), type: z.string(), options: z.object({ choices: z.array(z.object({ name: z.string() })).optional() }).passthrough().optional(),
    })) })) }).safeParse(await this.request(`meta/bases/${baseId}/tables`));
    const table = parsed.success ? parsed.data.tables.find(t => t.id === tableId) : null;
    if (!table) throw new AirtableError("SCHEMA_CHANGED");
    return table.fields;
  }
  async readRecord(baseId: string, tableId: string, recordId: string, fields: readonly string[]): Promise<Record<string, unknown>> {
    checkId(baseId, "app"); checkId(tableId, "tbl"); checkId(recordId, "rec");
    fields.forEach(id => checkId(id, "fld"));
    const params = new URLSearchParams({ filterByFormula: `RECORD_ID()="${recordId}"`, maxRecords: "1", returnFieldsByFieldId: "true" });
    fields.forEach(id => params.append("fields[]", id));
    const parsed = z.object({ records: z.array(recordSchema) }).safeParse(await this.request(`${baseId}/${tableId}?${params}`));
    if (!parsed.success || parsed.data.records.length !== 1 || parsed.data.records[0].id !== recordId) throw new AirtableError("NOT_FOUND");
    if (parsed.data.records[0].details) throw new AirtableError("ACCESS_LOST");
    return parsed.data.records[0].fields;
  }
  async update(baseId: string, tableId: string, recordId: string, fields: AirtableFields): Promise<void> {
    checkId(baseId, "app"); checkId(tableId, "tbl"); checkId(recordId, "rec");
    Object.keys(fields).forEach(id => checkId(id, "fld"));
    const result = recordSchema.safeParse(await this.request(`${baseId}/${tableId}/${recordId}`, {
      method: "PATCH", body: JSON.stringify({ fields, typecast: false, returnFieldsByFieldId: true }),
    }, true));
    if (!result.success || result.data.id !== recordId || result.data.details || !sameCells(fields, result.data.fields)) throw new AirtableError("UNCERTAIN");
  }
}
