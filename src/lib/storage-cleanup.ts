import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";

type Admin = SupabaseClient<Database>;

/** Register crash recovery before bytes cross the database/storage boundary. */
export async function registerCleanupIntent(
  admin: Admin,
  bucket: string,
  path: string,
  claimId?: string | null,
): Promise<boolean> {
  const { error } = await admin.rpc("enqueue_storage_cleanup_exact", {
    p_bucket_id: bucket,
    p_object_paths: [path],
    p_claim_id: claimId ?? null,
  });
  if (error) console.error("[storage] cleanup intent failed");
  return !error;
}

/**
 * Defer exact cleanup until the worker can exclude committed document paths.
 * A failed database response can hide a successful commit. Deleting bytes here
 * would bypass the queue's attachment guard and destroy that document.
 */
export async function removeOrQueueExact(
  admin: Admin,
  bucket: string,
  paths: string[],
  claimId?: string | null,
): Promise<void> {
  if (paths.length === 0) return;

  try {
    const { error } = await admin.rpc("enqueue_storage_cleanup_exact", {
      p_bucket_id: bucket,
      p_object_paths: paths,
      p_claim_id: claimId ?? null,
    });
    if (error) console.error("[storage] durable cleanup enqueue failed");
  } catch {
    // The pre-upload intent remains available if this retry cannot be saved.
    console.error("[storage] durable cleanup enqueue failed");
  }
}
