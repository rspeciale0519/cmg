import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  CLEANUP_LEASE_SECONDS,
  CLEANUP_MAX_ATTEMPTS,
  drainStorageCleanup,
  type CleanupClaim,
  type CleanupFailure,
  type CleanupStore,
} from "./processor";
import { removeExactQueuedObject } from "./storage";

type Admin = SupabaseClient<Database>;

async function requireSettledRow(
  query: PromiseLike<{
    data: { id: number } | null;
    error: { message: string } | null;
  }>,
  id: number,
): Promise<void> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(`Storage cleanup lease for queue row ${id} is no longer current.`);
  }
}

export function supabaseCleanupStore(admin: Admin): CleanupStore {
  return {
    async claim(limit) {
      const { data, error } = await admin.rpc("claim_storage_cleanup_batch", {
        p_limit: limit,
        p_lease_seconds: CLEANUP_LEASE_SECONDS,
        p_max_attempts: CLEANUP_MAX_ATTEMPTS,
      });

      if (error) throw new Error(error.message);
      return (data ?? []) as CleanupClaim[];
    },

    async settleSuccess(claim) {
      await requireSettledRow(
        admin
          .from("storage_cleanup_queue")
          .update({ processed_at: new Date().toISOString(), last_error: null })
          .eq("id", claim.id)
          .eq("attempts", claim.attempts)
          .is("processed_at", null)
          .is("dead_at", null)
          .select("id")
          .maybeSingle(),
        claim.id,
      );
    },

    async settleFailure(failure: CleanupFailure) {
      const patch: Database["public"]["Tables"]["storage_cleanup_queue"]["Update"] = {
        last_error: failure.error,
      };

      if (failure.outcome === "dead") {
        patch.dead_at = new Date().toISOString();
      } else if (failure.retryInSeconds !== null) {
        patch.next_attempt_at = new Date(
          Date.now() + failure.retryInSeconds * 1000,
        ).toISOString();
      }

      await requireSettledRow(
        admin
          .from("storage_cleanup_queue")
          .update(patch)
          .eq("id", failure.claim.id)
          .eq("attempts", failure.claim.attempts)
          .is("processed_at", null)
          .is("dead_at", null)
          .select("id")
          .maybeSingle(),
        failure.claim.id,
      );
    },
  };
}

export async function sweepStorageCleanup(admin: Admin, limit: number) {
  return drainStorageCleanup(
    supabaseCleanupStore(admin),
    (bucketId, objectPath) =>
      removeExactQueuedObject(admin.storage, bucketId, objectPath),
    limit,
  );
}
