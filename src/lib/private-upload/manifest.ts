import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CLAIM_DOCS_BUCKET } from "@/lib/actions/intake-storage";
import type { DocumentKind, DocumentVisibility } from "@/lib/claims/documents";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, MAX_FILES, safeOriginalName } from "@/lib/validators/files";

const metadataSchema = z.array(z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
  mime: z.string().max(150).transform((value) => value.toLowerCase().split(";")[0].trim())
    .refine((value) => Object.hasOwn(ALLOWED_MIME_TYPES, value)),
}).strict()).min(1).max(MAX_FILES);

export type PrivateUploadFile = {
  index: number;
  upload_path: string;
  storage_path: string;
  original_name: string;
  kind: DocumentKind;
  visibility: DocumentVisibility;
  mime: string;
  size_bytes: number;
};
export type PrivateUploadMetadata = z.infer<typeof metadataSchema>;

/** Parse metadata only. Any File entry means the caller used the old byte path. */
export function parsePrivateUploadManifest(formData: FormData) {
  if ([...formData.values()].some((value) => typeof value !== "string")) return null;
  const raw = formData.get("uploadManifest");
  if (typeof raw !== "string" || raw.length > 8_192) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = metadataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function allocatePrivateUploadManifest(
  sessionId: string,
  claimId: string,
  metadata: NonNullable<ReturnType<typeof parsePrivateUploadManifest>>,
  kind: DocumentKind,
  visibility: DocumentVisibility,
): PrivateUploadFile[] {
  return metadata.map((file, index) => {
    const extension = ALLOWED_MIME_TYPES[file.mime];
    return {
      index,
      upload_path: `private-upload/${sessionId}/${randomUUID()}.${extension}`,
      storage_path: `claims/${claimId}/${randomUUID()}.${extension}`,
      original_name: safeOriginalName(file.name),
      kind,
      visibility,
      mime: file.mime,
      size_bytes: file.size,
    };
  });
}

export const PRIVATE_UPLOAD_BUCKET = CLAIM_DOCS_BUCKET;
