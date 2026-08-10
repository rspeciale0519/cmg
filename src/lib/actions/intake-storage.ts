import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ValidatedUpload } from "@/lib/validators/files";

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
 * Runs before any row is written, so a failure here leaves no database trace at
 * all — the caller only has to sweep the objects that did land.
 */
export async function uploadIntakeFiles(
  admin: Admin,
  intakeId: string,
  files: ValidatedUpload[],
): Promise<{ ok: true; objects: UploadedObject[] } | { ok: false; uploaded: string[] }> {
  const objects: UploadedObject[] = [];

  for (const upload of files) {
    const path = `intake/${intakeId}/${crypto.randomUUID()}.${upload.extension}`;

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

/** Best-effort sweep of orphaned bytes. Never throws — the caller is already
 *  on an error path and a failed cleanup must not mask the original fault. */
export async function removeObjects(admin: Admin, paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  try {
    const { error } = await admin.storage.from(CLAIM_DOCS_BUCKET).remove(paths);
    if (error) {
      console.error("[intake] orphaned object cleanup failed", {
        paths,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("[intake] orphaned object cleanup threw", error);
  }
}
