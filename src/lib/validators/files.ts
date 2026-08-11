/**
 * Server-side upload rules. These mirror the database exactly — the
 * `documents_mime_allowlist` and `documents_size_bytes_range` CHECKs and the
 * `claim-docs` bucket's own `allowed_mime_types` / `file_size_limit` (see
 * supabase/migrations/20260809120000_initial_schema.sql and …_storage.sql).
 * The client repeats them for a fast error; only this pass is trusted.
 */

export const MAX_FILE_BYTES = 26_214_400; // 25 MiB, = documents_size_bytes_range
export const MAX_FILES = 10;

/** mime → canonical extension used to build the UUID storage filename. */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** `accept` attribute for the file input — advisory only, never a control. */
export const FILE_ACCEPT_ATTRIBUTE = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".docx",
  ...Object.keys(ALLOWED_MIME_TYPES),
].join(",");

export const FILE_RULES_HINT =
  "PDF, JPG, PNG, WEBP, HEIC or DOCX · up to 10 files · 25 MB each";

export type ValidatedUpload = {
  file: File;
  mime: string;
  extension: string;
  size: number;
  originalName: string;
};

export type FileValidationResult =
  | { ok: true; files: ValidatedUpload[] }
  | { ok: false; message: string };

/**
 * `original_name` is stored for display only — the object itself is written
 * under a UUID (spec §7.4). Drop path separators and control characters so a
 * crafted name cannot travel anywhere it is later interpolated.
 */
function safeOriginalName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  const cleaned = Array.from(base)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();

  return (cleaned.length > 0 ? cleaned : "upload").slice(0, 200);
}

export function validateUploads(entries: unknown[]): FileValidationResult {
  const files = entries.filter(
    (entry): entry is File =>
      typeof File !== "undefined" && entry instanceof File && entry.size > 0,
  );

  if (files.length === 0) {
    return { ok: true, files: [] };
  }

  if (files.length > MAX_FILES) {
    return {
      ok: false,
      message: `Attach at most ${MAX_FILES} files. Email any extras to us instead.`,
    };
  }

  const validated: ValidatedUpload[] = [];

  for (const file of files) {
    const mime = (file.type || "").toLowerCase().split(";")[0].trim();
    /* `Object.hasOwn` before the index, because `mime` is the per-part
       Content-Type of a multipart upload and therefore attacker text on a public
       unauthenticated route (/file-a-claim).

       `ALLOWED_MIME_TYPES[mime]` walks the prototype chain. `.toLowerCase()`
       happens to defuse most of it — `toString` becomes `tostring`, which is not
       a property of anything — but two prototype members are already lowercase
       and survive verbatim: `Content-Type: constructor` returned the `Object`
       function and `Content-Type: __proto__` returned `Object.prototype`. Both
       are truthy, so `if (!extension)` waved the file through, and the allowlist
       this module's header calls "the only pass that is trusted" was defeated by
       a header value. What stopped the upload after that was the bucket's own
       allowed_mime_types and the documents_mime_allowlist CHECK — so nothing
       landed, but the caller got the generic failure instead of the sentence
       that tells them which formats to use, and the app-layer guarantee was not
       one. */
    const extension = Object.hasOwn(ALLOWED_MIME_TYPES, mime)
      ? ALLOWED_MIME_TYPES[mime]
      : undefined;

    if (!extension) {
      return {
        ok: false,
        message: `"${safeOriginalName(file.name)}" is not a file type we accept. Use ${FILE_RULES_HINT}.`,
      };
    }

    if (file.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        message: `"${safeOriginalName(file.name)}" is larger than 25 MB. Send it by email instead.`,
      };
    }

    validated.push({
      file,
      mime,
      extension,
      size: file.size,
      originalName: safeOriginalName(file.name),
    });
  }

  return { ok: true, files: validated };
}
