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

/**
 * The formats alone, as a phrase that can finish a sentence.
 *
 * Separate from `FILE_RULES_HINT` because the two are read in different places
 * and one of them is a remedy. The hint sits under a field and states all three
 * limits at a glance; a refusal names the fault the reader actually hit and then
 * tells them what to do about *that*, so a wrong format must not be answered
 * with the size cap and the file count in a middle-dot fragment.
 */
export const ACCEPTED_FORMATS = "PDF, JPG, PNG, WEBP, HEIC or DOCX";

export const FILE_RULES_HINT = `${ACCEPTED_FORMATS} · up to 10 files · 25 MB each`;

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
export function safeOriginalName(name: string): string {
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
  const rejected: { why: "type" | "size"; name: string }[] = [];

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
      rejected.push({ why: "type", name: safeOriginalName(file.name) });
      continue;
    }

    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ why: "size", name: safeOriginalName(file.name) });
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
    /* One clause per *fault*, not one per file, and only the remedies that
       apply.

       Naming the fault once and the files inside it is the difference between
       `"a.txt" is not a file type we accept, "b.xlsx" is not a file type we
       accept and "c.zip" is not a file type we accept` and one readable
       sentence. And the remedy is a remedy: this used to interpolate
       `FILE_RULES_HINT`, which is the *field hint* — a middle-dot fragment
       carrying the format list, the file-count cap and the size cap — so a
       reader whose only problem was a format had the size limit read back to
       them in something that is not a sentence. */
    const clauses = (["type", "size"] as const)
      .map((why) => {
        const names = rejected.filter((entry) => entry.why === why).map((entry) => `"${entry.name}"`);
        if (names.length === 0) return null;
        const list =
          names.length === 1
            ? names[0]
            : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
        const verb = names.length === 1 ? "is" : "are";
        return why === "type"
          ? `${list} ${verb} not a file type we accept`
          : `${list} ${verb} larger than 25 MB`;
      })
      .filter((clause): clause is string => clause !== null);

    const advice = [
      rejected.some((entry) => entry.why === "type") && `Use ${ACCEPTED_FORMATS}.`,
      rejected.some((entry) => entry.why === "size") &&
        "Send anything larger by email instead.",
    ].filter((sentence): sentence is string => typeof sentence === "string");

    return { ok: false, message: `${clauses.join(", and ")}. ${advice.join(" ")}` };
  }

  return { ok: true, files: validated };
}
