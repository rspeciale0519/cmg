import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type Admin = SupabaseClient<Database>;

/**
 * The app-level half of the audit trail. Spec §7.7 puts DB triggers on claim,
 * document, financial and consent mutations, and names the rest — signed-URL
 * issuance, invite events, MFA events, role changes — as explicit application
 * writes, because they either happen outside Postgres or carry context no
 * trigger can see (which token, which factor, which IP).
 *
 * `audit_log` has no UPDATE or DELETE policy and no foreign keys, so a row
 * written here cannot later be rewritten or orphaned by deleting the actor.
 */
export type AuditEvent = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
};

export async function writeAudit(admin: Admin, event: AuditEvent): Promise<void> {
  const { error } = await admin.from("audit_log").insert({
    actor_id: event.actorId ?? null,
    action: event.action,
    entity: event.entity,
    entity_id: event.entityId ?? null,
    meta: (event.meta ?? {}) as Json,
    ip: event.ip ?? null,
  });

  // Never throws. An audit write that fails must be shouted about, but it must
  // not roll back the security-relevant action it is recording — refusing a
  // sign-in because the log is full is a denial of service with extra steps.
  if (error) {
    console.error("[audit] write failed", { action: event.action, error: error.message });
  }
}
