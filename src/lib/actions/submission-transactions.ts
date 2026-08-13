import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type Admin = SupabaseClient<Database>;

const resultSchema = z.object({
  id: z.string().uuid().optional(),
  claim_ref: z.string().optional(),
  lead_id: z.string().uuid().optional(),
  outbox_ids: z.array(z.string().uuid()),
});

export type TransactionResult = z.infer<typeof resultSchema>;

export async function submitClaimUnit(
  admin: Admin,
  input: {
    claim: Json;
    claimants: Json;
    consents: Json;
    documents: Json;
    outbox: Json;
    audit?: Json;
    partnerCompanyId?: string | null;
  },
): Promise<TransactionResult | null> {
  const { data, error } = await admin.rpc("submit_claim_transaction", {
    p_claim: input.claim,
    p_claimants: input.claimants,
    p_consents: input.consents,
    p_documents: input.documents,
    p_outbox: input.outbox,
    p_audit: input.audit ?? null,
    p_partner_company_id: input.partnerCompanyId ?? null,
  });
  if (error) {
    console.error("[submission] atomic claim failed", error.message);
    return null;
  }
  const parsed = resultSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function submitContactUnit(
  admin: Admin,
  input: { lead: Json; consent: Json; outbox: Json },
): Promise<TransactionResult | null> {
  const { data, error } = await admin.rpc("submit_contact_transaction", {
    p_lead: input.lead,
    p_consent: input.consent,
    p_outbox: input.outbox,
  });
  if (error) {
    console.error("[contact] atomic submission failed", error.message);
    return null;
  }
  const parsed = resultSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
