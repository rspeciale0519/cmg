import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";
import type { ValidatedUpload } from "@/lib/validators/files";
import { registerCleanupIntent, removeOrQueueExact } from "@/lib/storage-cleanup";

type Admin = SupabaseClient<Database>;

export const CLAIM_DOCS_BUCKET = "claim-docs";

export type UploadedObject = {
  path: string;
  originalName: string;
  mime: string;
  size: number;
};

/**
 * Uploads to `intake/{intakeId}/{uuid}.{ext}` — the pre-accept prefix, which
 * `documents_storage_path_matches_claim` pins to exactly that shape. The stored
 * filename is always a fresh UUID; the submitter's filename survives only as
 * `documents.original_name` (spec §7.4).
 *
 * Register each cleanup intent before uploading bytes. Claim submission then
 * attaches files in one database transaction. The worker removes only paths
 * that no document references.
 */
export async function uploadIntakeFiles(
  admin: Admin,
  intakeId: string,
  files: ValidatedUpload[],
): Promise<{ ok: true; objects: UploadedObject[] } | { ok: false; uploaded: string[] }> {
  const objects: UploadedObject[] = [];

  for (const upload of files) {
    const path = `intake/${intakeId}/${crypto.randomUUID()}.${upload.extension}`;
    if (!(await registerCleanupIntent(admin, CLAIM_DOCS_BUCKET, path))) {
      return { ok: false, uploaded: objects.map((object) => object.path) };
    }

    const { error } = await admin.storage
      .from(CLAIM_DOCS_BUCKET)
      .upload(path, upload.file, {
        contentType: upload.mime,
        upsert: false,
      });

    if (error) {
      console.error("[intake] storage upload failed", {
        path,
        message: error.message,
      });
      return { ok: false, uploaded: objects.map((object) => object.path) };
    }

    objects.push({
      path,
      originalName: upload.originalName,
      mime: upload.mime,
      size: upload.size,
    });
  }

  return { ok: true, objects };
}

/** Queue exact paths for guarded cleanup after an uncertain upload or database
 *  result. Never throws, so enqueue failures do not mask the original fault. */
export async function removeObjects(admin: Admin, paths: string[]): Promise<void> {
  await removeOrQueueExact(admin, CLAIM_DOCS_BUCKET, paths);
}
