import type { FormState } from "@/lib/actions/types";
import type { IntakeFileMetadata } from "@/lib/intake/upload-types";
import { validateUploads } from "@/lib/validators/files";

export type PrivateUploadSession = {
  id: string;
  token: string;
  expiresAt: string;
  uploads: Array<{ index: number; path: string; token: string; mime: string }>;
};

export type PrivatePrepareState = FormState & { uploadSession?: PrivateUploadSession };
export type PrivateFinalizeState = FormState & { pendingFiles?: number; restartAllowed?: boolean };

export function privateFinalizeData(session: Pick<PrivateUploadSession, "id" | "token">) {
  const data = new FormData();
  data.set("id", session.id);
  data.set("token", session.token);
  return data;
}

export function privateUploadStartData(data: FormData, files: File[]) {
  const validated = validateUploads(files);
  if (!validated.ok) return validated;
  const payload = new FormData();
  for (const [name, value] of data.entries()) {
    if (typeof value === "string" && name !== "files" && name !== "uploadManifest") payload.append(name, value);
  }
  const manifest: IntakeFileMetadata[] = validated.files.map(({ originalName, size, mime }) => ({
    name: originalName, size, mime,
  }));
  payload.set("uploadManifest", JSON.stringify(manifest));
  return { ok: true as const, payload, files: validated.files.map(({ file }) => file) };
}

export function privateUploadsMatchFiles(session: PrivateUploadSession, files: File[]) {
  const indices = new Set(session.uploads.map(({ index }) => index));
  return session.uploads.length === files.length && indices.size === files.length &&
    session.uploads.every((upload) => Number.isInteger(upload.index) && upload.index >= 0 &&
      upload.index < files.length && upload.mime === files[upload.index].type.toLowerCase().split(";")[0].trim());
}

export async function uploadPrivateFile(upload: PrivateUploadSession["uploads"][number], file: File) {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { error } = await createClient().storage.from("claim-docs").uploadToSignedUrl(
      upload.path, upload.token, file, { contentType: upload.mime, upsert: false },
    );
    if (error) {
      if (process.env.NODE_ENV !== "production") {
        const details = error as { status?: unknown; code?: unknown };
        const status = details.status;
        const knownCodes = new Set([
          "AccessDenied", "EntityTooLarge", "InvalidJWT", "InvalidMimeType", "InvalidRequest",
          "InvalidToken", "MissingContentLength", "NoSuchBucket", "ResourceAlreadyExists",
        ]);
        console.warn("[private-upload] Storage upload failed", {
          status: typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
            ? status
            : "unknown",
          code: typeof details.code === "string" && knownCodes.has(details.code) ? details.code : "unknown",
        });
      }
      return false;
    }
    return true;
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[private-upload] Storage upload request failed", { status: "network" });
    }
    return false;
  }
}
