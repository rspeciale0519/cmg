import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { airtableEnabled } from "./config";
import { accessToken } from "./oauth";
import { AirtableError } from "./client";
import { deliverOne, readySchema, type DeliveryStore } from "./delivery";

export async function runAirtableDelivery(claimId?: string): Promise<number> {
  if (!airtableEnabled()) return 0;
  const admin = createAdminClient();
  const store: DeliveryStore = {
    async ready(lease,reconcile=false) {
      const { data: work, error: failed } = await admin.rpc("airtable_request_ready", { p_request_id: lease.id, p_lease_token: lease.leaseToken, p_reconcile: reconcile });
      if (failed) throw new Error("AIRTABLE_QUEUE_UNAVAILABLE");
      return work === null ? null : readySchema.parse(work);
    },
    async settle(lease,outcome,values,errorCode) {
      const { data: settled, error: failed } = await admin.rpc("settle_airtable_request", { p_request_id: lease.id, p_lease_token: lease.leaseToken,
        p_outcome: outcome, p_values: values, ...(errorCode ? { p_error: errorCode } : {}) });
      if (failed || settled !== true) throw new Error("AIRTABLE_SETTLEMENT_UNCERTAIN");
    },
    token: accessToken,
    async pace(baseId) {
      const { data: milliseconds, error: failed } = await admin.rpc("reserve_airtable_rate_slot", { p_base_id: baseId });
      if (failed || milliseconds === null || milliseconds < 0) throw new AirtableError("RATE_LIMIT");
      if (milliseconds > 0) await new Promise(resolve => setTimeout(resolve,milliseconds));
    },
  };
  let sent=0;
  const started=Date.now();
  // Reserve one item at a time. Unstarted work never receives a doomed lease.
  for(let count=0;count<3 && Date.now()-started<10000;count++) {
    const {data,error}=await admin.rpc("claim_airtable_batch",{p_limit:1,...(claimId?{p_claim_id:claimId}:{})});
    if(error) throw new Error("AIRTABLE_QUEUE_UNAVAILABLE");
    const leases=z.array(z.object({id:z.uuid(),leaseToken:z.uuid(),uncertain:z.boolean()})).max(1).parse(data);
    if(!leases.length) break;
    if(await deliverOne(leases[0],store)==="sent") sent++;
  }
  return sent;
}
/** Call only after the source transaction succeeds. Failed work remains in the queue. */
export function scheduleAirtableDelivery(claimId: string): void {
  if (!airtableEnabled()) return;
  after(async () => {
    try { await runAirtableDelivery(claimId); }
    catch { console.error("[airtable] queued work requires a later delivery check"); }
  });
}
