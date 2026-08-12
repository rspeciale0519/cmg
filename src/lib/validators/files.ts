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
  /**
   * Every offender, not the first one.
   *
   * Both refusals below used to `return` from inside this loop, so a selection
   * of ten files with a `.txt` at #2 and a 40 MB scan at #5 sent all ten over
   * the wire, came back naming only #2 — and a file input cannot be re-seeded
   * by any page, which `document-upload.tsx` says in as many words, so the
   * operator re-picked nine files, re-uploaded them all, and only then heard
   * about #5. `parseMoneyFields` was fixed for exactly this shape four files
   * away: "a form the staff member could have corrected in one pass cost two
   * round trips and taught them the summary could not be trusted to be
   * complete." The upload path is the more expensive of the two.
   */
  const rejected: { why: "type" | "size"; text: string }[] = [];

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
      rejected.push({
        why: "type",
        text: `"${safeOriginalName(file.name)}" is not a file type we accept`,
      });
      continue;
    }

    if (file.size > MAX_FILE_BYTES) {
      rejected.push({
        why: "size",
        text: `"${safeOriginalName(file.name)}" is larger than 25 MB`,
      });
      continue;
    }

    validated.push({
      file,
      mime,
      extension,
      size: file.size,
      originalName: safeOriginalName(file.name),
    });
  }

  if (rejected.length > 0) {
    // Every offender in one sentence, so the selection can be fixed in a single
    // pass — and only the remedies that apply. A reader whose only problem is a
    // 40 MB scan does not need the format list read to them.
    const names = rejected.map((entry) => entry.text);
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

    const advice = [
      rejected.some((entry) => entry.why === "type") && `Use ${FILE_RULES_HINT}.`,
      rejected.some((entry) => entry.why === "size") &&
        "Send anything over 25 MB by email instead.",
    ].filter((sentence): sentence is string => typeof sentence === "string");

    return { ok: false, message: `${list}. ${advice.join(" ")}` };
  }

  return { ok: true, files: validated };
}
