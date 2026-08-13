import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

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
  if (error) console.error("[storage] cleanup intent failed", error.message);
  return !error;
}

/** Remove only the named objects; persist the exact keys if Storage is unavailable. */
export async function removeOrQueueExact(
  admin: Admin,
  bucket: string,
  paths: string[],
  claimId?: string | null,
): Promise<void> {
  if (paths.length === 0) return;

  let removalFailed = false;
  try {
    const { error } = await admin.storage.from(bucket).remove(paths);
    removalFailed = Boolean(error);
    if (error) console.error("[storage] exact cleanup failed", error.message);
  } catch (error) {
    removalFailed = true;
    console.error("[storage] exact cleanup threw", error);
  }

  if (!removalFailed) return;
  const { error } = await admin.rpc("enqueue_storage_cleanup_exact", {
    p_bucket_id: bucket,
    p_object_paths: paths,
    p_claim_id: claimId ?? null,
  });
  if (error) {
    console.error("[storage] durable cleanup enqueue failed", {
      bucket,
      paths,
      message: error.message,
    });
  }
}
