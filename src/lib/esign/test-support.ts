import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Helpers for the database-backed e-signature suites. Not a test file itself
 * and never imported by application code.
 *
 * The suites talk to the running local Supabase stack because the things worth
 * proving here — the unique-primary-key dedupe, the `lor_signed` transition
 * gate, the storage object actually landing in the private bucket — are
 * properties of the database, and a hand-rolled fake would only prove that the
 * fake agrees with itself.
 */

export type TestAdmin = SupabaseClient<Database>;

/**
 * `.env.local` is git-ignored; CI supplies the same names as real env vars.
 *
 * Deliberately a two-name allowlist. Slurping the whole file would also import
 * `RESEND_API_KEY` and the PandaDoc credentials, and a suite that enqueues
 * notifications would then try to deliver them for real — tests must not be
 * able to email anyone or call a third-party API by accident.
 */
const LOADABLE = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;

export function loadLocalEnv(): void {
  if (process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!(LOADABLE as readonly string[]).includes(key) || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

export function testAdminClient(): TestAdmin {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("local Supabase credentials are not configured");

  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * True when the local stack answers. The database suites gate on this so that
 * `npm test` on a machine (or a CI job) without the stack running reports the
 * pure suites honestly instead of failing on connection refused. The CI
 * `database` job does start the stack and does run them.
 */
export async function localSupabaseAvailable(): Promise<boolean> {
  loadLocalEnv();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return false;
  }

  try {
    const { error } = await testAdminClient()
      .from("pandadoc_webhook_events")
      .select("event_id")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

export type SeededClaim = {
  id: string;
  claimRef: string;
  claimantEmails: string[];
};

const suffix = () => Math.random().toString(36).slice(2, 8);

/**
 * Fixtures carry their own reference in a year that cannot occur, rather than
 * letting `public.next_claim_ref()` mint one.
 *
 * `claims_before_insert()` only generates a reference when the caller leaves
 * the column blank, and `claims_claim_ref_shape` is the only rule about what a
 * supplied one may look like. Taking that route keeps the per-year counter
 * exactly where the seed left it — which matters because
 * `01_claim_ref_and_status.test.sql` asserts the next reference against the
 * seed, and because three suites seeding in parallel would otherwise race each
 * other's restore of a shared counter row.
 */
export const fixtureClaimRef = () =>
  `CMG-2099-${String(Math.floor(Math.random() * 9000) + 1000)}`;

/**
 * A claim with two claimants, walked forward one legal transition at a time —
 * `claims_before_insert()` refuses a claim born mid-lifecycle, and
 * `enforce_claim_status_transition()` refuses a jump.
 */
export async function seedClaim(
  admin: TestAdmin,
  options: { status: "under_review" | "lor_sent"; claimants?: number } = {
    status: "lor_sent",
  },
): Promise<SeededClaim> {
  const tag = suffix();

  const { data: claim, error } = await admin
    .from("claims")
    .insert({
      claim_ref: fixtureClaimRef(),
      property_street: `${tag} Test Way`,
      property_city: "Orlando",
      property_state: "Florida",
      property_zip: "32801",
      carrier: "Citizens",
      policy_number: `POL-${tag}`,
      lor_contract_type: "non_emergency",
      carrier_tenure: "three_plus_years",
      prior_roof_claim: false,
      loss_date: "2026-07-01",
      loss_time: "12:00:00",
      cause: "hurricane",
      description: "esign suite fixture",
    })
    .select("id, claim_ref")
    .single();

  if (error || !claim) throw new Error(`seed claim failed: ${error?.message}`);

  const count = options.claimants ?? 2;
  const emails = Array.from({ length: count }, (_, index) =>
    `esign.${tag}.${index + 1}@example.com`,
  );

  const { error: claimantError } = await admin.from("claimants").insert(
    emails.map((email, index) => ({
      claim_id: claim.id,
      first_name: index === 0 ? "Dana" : "Robin",
      last_name: `Test${tag}`,
      email,
      initials: index === 0 ? "DT" : "RT",
      is_primary: index === 0,
    })),
  );
  if (claimantError) throw new Error(`seed claimants failed: ${claimantError.message}`);

  const walk: Array<"under_review" | "lor_sent"> =
    options.status === "under_review" ? ["under_review"] : ["under_review", "lor_sent"];

  for (const status of walk) {
    const { error: stepError } = await admin
      .from("claims")
      .update({ status })
      .eq("id", claim.id);
    if (stepError) throw new Error(`seed transition to ${status} failed: ${stepError.message}`);
  }

  return { id: claim.id, claimRef: claim.claim_ref, claimantEmails: emails };
}

/**
 * Removes the claim (cascading its children), anything it left in storage, the
 * notifications it queued, its audit entries and the storage-cleanup rows the
 * document delete enqueued.
 *
 * Thoroughness matters here beyond tidiness: `supabase test db` runs pgTAP
 * against the *live* database, and several of those assertions are written
 * against the seeded fixture — a stray claim, notification or audit row turns
 * a green suite red for reasons that have nothing to do with the schema.
 */
async function safely(what: string, run: () => PromiseLike<unknown>): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`[esign-test] cleanup step "${what}" failed`, error);
  }
}

export async function cleanupClaim(
  admin: TestAdmin,
  claimId: string,
  claimRef?: string,
): Promise<void> {
  await safely(`claim ${claimId}`, () => removeClaim(admin, claimId, claimRef));
}

/* Every step is best-effort and none may throw: a cleanup that aborts halfway
   strands the remaining fixtures in a database that pgTAP then reads. */
async function removeClaim(
  admin: TestAdmin,
  claimId: string,
  claimRef?: string,
): Promise<void> {
  const { data: objects } = await admin.storage
    .from("claim-docs")
    .list(`claims/${claimId}`);

  if (objects && objects.length > 0) {
    await admin.storage
      .from("claim-docs")
      .remove(objects.map((object) => `claims/${claimId}/${object.name}`));
  }

  if (claimRef) {
    await admin
      .from("notifications_outbox")
      .delete()
      .filter("payload->>claimRef", "eq", claimRef);
  }

  /* The audit triggers key their entries on the child row's own id, so the
     claim id alone does not find them. Collect the children before the cascade
     removes the rows that name them. */
  const childIds: string[] = [];
  for (const table of ["claimants", "claim_status_history", "documents", "consents"] as const) {
    const { data } = await admin.from(table).select("id").eq("claim_id", claimId);
    for (const row of data ?? []) childIds.push(row.id);
  }

  await admin.from("consents").delete().eq("claim_id", claimId);
  await admin.from("claims").delete().eq("id", claimId);
  await admin.from("audit_log").delete().eq("entity_id", claimId);
  if (childIds.length > 0) {
    await admin.from("audit_log").delete().in("entity_id", childIds);
  }
  await admin.from("storage_cleanup_queue").delete().eq("claim_id", claimId);
}

export async function cleanupWebhookEvents(
  admin: TestAdmin,
  eventIds: string[],
): Promise<void> {
  await safely("webhook audit rows", () =>
    admin.from("audit_log").delete().eq("entity", "pandadoc_webhook"),
  );
  if (eventIds.length === 0) return;
  await safely("webhook dedupe rows", () =>
    admin.from("pandadoc_webhook_events").delete().in("event_id", eventIds),
  );
}
