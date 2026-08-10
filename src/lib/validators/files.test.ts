import { describe, expect, it } from "vitest";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, MAX_FILES, validateUploads } from "./files";

const fileOf = (name: string, type: string, size = 1024) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("validateUploads", () => {
  it("accepts no files at all", () => {
    expect(validateUploads([])).toEqual({ ok: true, files: [] });
  });

  it("ignores the empty File the browser sends for an untouched input", () => {
    const result = validateUploads([fileOf("", "application/octet-stream", 0)]);
    expect(result).toEqual({ ok: true, files: [] });
  });

  it.each(Object.entries(ALLOWED_MIME_TYPES))(
    "accepts %s and maps it to .%s",
    (mime, extension) => {
      const result = validateUploads([fileOf(`declarations.${extension}`, mime)]);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.files[0].extension).toBe(extension);
    },
  );

  it("rejects a disallowed mime type", () => {
    const result = validateUploads([fileOf("payload.svg", "image/svg+xml")]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("not a file type we accept");
  });

  it("rejects a file with no mime type at all", () => {
    const result = validateUploads([fileOf("mystery", "")]);
    expect(result.ok).toBe(false);
  });

  it("rejects a file over 25 MB", () => {
    const result = validateUploads([
      fileOf("huge.pdf", "application/pdf", MAX_FILE_BYTES + 1),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("larger than 25 MB");
  });

  it("accepts a file at exactly the limit", () => {
    expect(
      validateUploads([fileOf("edge.pdf", "application/pdf", MAX_FILE_BYTES)]).ok,
    ).toBe(true);
  });

  it("rejects more than ten files", () => {
    const files = Array.from({ length: MAX_FILES + 1 }, (_, index) =>
      fileOf(`photo-${index}.jpg`, "image/jpeg"),
    );
    const result = validateUploads(files);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("at most 10 files");
  });

  it("accepts exactly ten files", () => {
    const files = Array.from({ length: MAX_FILES }, (_, index) =>
      fileOf(`photo-${index}.jpg`, "image/jpeg"),
    );
    expect(validateUploads(files).ok).toBe(true);
  });

  it("strips directory components from the retained original name", () => {
    const result = validateUploads([
      fileOf("../../etc/passwd.pdf", "application/pdf"),
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files[0].originalName).toBe("passwd.pdf");
  });

  it("tolerates a mime type carrying parameters", () => {
    const result = validateUploads([fileOf("scan.pdf", "application/pdf; version=1.7")]);
    expect(result.ok).toBe(true);
  });

  it("ignores non-File entries", () => {
    expect(validateUploads(["not a file", null, undefined])).toEqual({
      ok: true,
      files: [],
    });
  });
});
