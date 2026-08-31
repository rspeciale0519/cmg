import "server-only";

import { z } from "zod";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  MAX_FILES,
  safeOriginalName,
} from "@/lib/validators/files";

const metadataSchema = z.array(z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
  mime: z.string().max(150).transform((value) => value.toLowerCase().split(";")[0].trim())
    .refine((value) => Object.hasOwn(ALLOWED_MIME_TYPES, value)),
}).strict()).max(MAX_FILES);

export type IntakeManifestFile = {
  index: number;
  upload_path: string;
  storage_path: string;
  original_name: string;
  mime: string;
  size_bytes: number;
};

export function parseIntakeManifest(data: FormData) {
  // Public requests carry metadata only. Do not accept a second byte transport.
  if ([...data.values()].some((value) => typeof value !== "string" && value.size > 0)) {
    return null;
  }
  const raw = data.get("uploadManifest") ?? "[]";
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

export function allocateIntakeManifest(
  sessionId: string,
  files: z.infer<typeof metadataSchema>,
): IntakeManifestFile[] {
  return files.map((file, index) => ({
    index,
    upload_path: `intake/${sessionId}/${crypto.randomUUID()}.${ALLOWED_MIME_TYPES[file.mime]}`,
    // The upload capability never grants writes to the document destination.
    storage_path: `intake/${sessionId}/${crypto.randomUUID()}.${ALLOWED_MIME_TYPES[file.mime]}`,
    original_name: safeOriginalName(file.name),
    mime: file.mime,
    size_bytes: file.size,
  }));
}
