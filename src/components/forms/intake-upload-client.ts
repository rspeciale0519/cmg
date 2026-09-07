import type {
  IntakeFileMetadata,
  IntakeUploadSession,
} from "@/lib/intake/upload-types";
import { validateUploads } from "@/lib/validators/files";

/** Build a new payload so no File or Blob can reach a Server Action. */
export function intakeStartData(data: FormData, selectedFiles: File[]) {
  const validated = validateUploads(selectedFiles);
  if (!validated.ok) return validated;

  const payload = new FormData();
  for (const [name, value] of data.entries()) {
    if (typeof value === "string" && name !== "documents" && name !== "uploadManifest") {
      payload.append(name, value);
    }
  }

  const manifest: IntakeFileMetadata[] = validated.files.map((file) => ({
    name: file.originalName,
    size: file.size,
    mime: file.mime,
  }));
  payload.set("uploadManifest", JSON.stringify(manifest));
  return { ok: true as const, payload, files: validated.files.map(({ file }) => file) };
}

export function intakeUploadsMatchFiles(session: IntakeUploadSession, files: File[]) {
  const indices = new Set(session.uploads.map((upload) => upload.index));
  return session.uploads.length === files.length && indices.size === files.length &&
    session.uploads.every((upload) =>
      Number.isInteger(upload.index) && upload.index >= 0 && upload.index < files.length &&
      upload.mime === files[upload.index].type.toLowerCase().split(";")[0].trim(),
    );
}

/** The signing action also disables upsert; its token controls that permission. */
export async function uploadIntakeFile(
  upload: IntakeUploadSession["uploads"][number],
  file: File,
): Promise<boolean> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { error } = await createClient().storage.from("claim-docs").uploadToSignedUrl(
      upload.path,
      upload.token,
      file,
      { contentType: upload.mime, upsert: false },
    );
    return !error;
  } catch {
    // A missing response does not prove the object is missing. Finalization checks it.
    return false;
  }
}
