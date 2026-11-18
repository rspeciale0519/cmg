import { z } from "zod";
import { AirtableClient, AirtableError, sameCells } from "./client";
import { isShareField, type AirtableFields, type ShareField } from "./fields";
import { mapFields, mappingSchema, validateMappings } from "./mapping";

const cells = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
export const readySchema = z.object({
  request: z.object({ id: z.uuid(), claim_id: z.uuid(), connection_id: z.uuid(), record_id: z.string(),
    selected_fields: z.array(z.string().refine(isShareField)), source_values: cells, reviewed: z.boolean() }),
  connection: z.object({ id: z.uuid(), company_id: z.uuid(), base_id: z.string(), table_id: z.string(), mappings: mappingSchema }),
  lastValues: cells,
});
export type ReadyDelivery = z.infer<typeof readySchema>;
export type DeliveryLease = { id: string; leaseToken: string; uncertain: boolean };
export type DeliveryOutcome = "sent" | "retry" | "uncertain" | "review_required" | "superseded";
export interface DeliveryStore {
  ready(lease: DeliveryLease, reconcile?: boolean): Promise<ReadyDelivery | null>;
  settle(lease: DeliveryLease, outcome: DeliveryOutcome, values: AirtableFields, error: string | null): Promise<void>;
  token(connectionId: string, companyId: string): Promise<string>;
  pace(baseId: string): Promise<void>;
}

export async function deliverOne(lease: DeliveryLease, store: DeliveryStore, fetcher: typeof fetch = fetch): Promise<DeliveryOutcome> {
  let outcome: DeliveryOutcome = "review_required", error: string | null = null, desired: AirtableFields = {};
  try {
    const work = await store.ready(lease, lease.uncertain);
    if (!work) {
      const refused=lease.uncertain ? "uncertain" : "review_required";
      await store.settle(lease, refused, {}, "AUTHORITY_CHANGED"); return refused;
    }
    const { connection: c, request: r } = work;
    const client = new AirtableClient(await store.token(c.id, c.company_id), fetcher);
    await store.pace(c.base_id);
    const mappings = validateMappings(c.mappings, await client.schema(c.base_id,c.table_id));
    desired = mapFields(r.source_values, mappings, r.selected_fields as ShareField[], r.reviewed);
    if (Object.keys(desired).length === 0) throw new Error("EMPTY_UPDATE");
    await store.pace(c.base_id);
    const actual = await client.readRecord(c.base_id,c.table_id,r.record_id,Object.keys(desired));
    const identity = mappings.find(m => m.source === "claim_ref")!;
    if (actual[identity.fieldId] && actual[identity.fieldId] !== r.source_values.claim_ref) throw new Error("WRONG_CLAIM");
    if (sameCells(desired,actual)) outcome="sent";
    else {
      const expected = Object.fromEntries(Object.keys(desired).map(id => [id, work.lastValues[id] ?? null]));
      if (!sameCells(expected,actual)) throw new Error("EXTERNAL_CHANGE");
      await store.pace(c.base_id);
      // Check after rate waiting so a queued slot cannot outlive authority.
      if (!await store.ready(lease, false)) {
        await store.settle(lease,"superseded",{},"SOURCE_CHANGED");
        return "superseded";
      }
      await client.update(c.base_id,c.table_id,r.record_id,desired);
      outcome="sent";
    }
  } catch (caught) {
    error = caught instanceof AirtableError ? caught.code : "REVIEW_REQUIRED";
    if (lease.uncertain || (caught instanceof AirtableError && caught.code === "UNCERTAIN")) outcome="uncertain";
    else if (caught instanceof AirtableError && ["RATE_LIMIT","PROVIDER_FAILED"].includes(caught.code)) outcome=lease.uncertain ? "uncertain" : "retry";
  }
  await store.settle(lease,outcome,outcome === "sent" ? desired : {},error);
  return outcome;
}
