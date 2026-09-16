import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";

export type IntakeReferral = { id: string; name: string };
type ReferralResult = { ok: true; partner: IntakeReferral | null } | { ok: false };

/** A public link records provenance only. It is never an access credential. */
export async function resolveIntakeReferral(
  admin: SupabaseClient<Database>, code: FormDataEntryValue | null,
): Promise<ReferralResult> {
  if (code === null || code === "") return { ok: true, partner: null };
  if (typeof code !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code)) {
    return { ok: false };
  }
  const { data, error } = await admin.from("partner_companies")
    .select("id, name").eq("intake_referral_code", code).eq("status", "active").maybeSingle();
  if (error || !data) return { ok: false };
  return { ok: true, partner: { id: data.id, name: data.name } };
}
