import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeUploadSession } from "@/lib/intake/upload-types";
import { MAX_FILE_BYTES, MAX_FILES } from "@/lib/validators/files";
import { intakeStartData, intakeUploadsMatchFiles, uploadIntakeFile } from "./intake-upload-client";

const { from, uploadToSignedUrl } = vi.hoisted(() => ({
  from: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from } }),
}));

function pdf(name = "policy.pdf", size = 12) {
  const file = new File(["file contents"], name, { type: "application/pdf" });
  // Exercise metadata limits without allocating 250 MiB in a unit test.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

const capability = { index: 0, path: "intake/test/document.pdf", token: "test-only-token", mime: "application/pdf" };
const session: IntakeUploadSession = {
  id: "test-session", token: "test-session-token", expiresAt: "2026-08-31T02:00:00Z",
  uploads: [capability],
};

beforeEach(() => {
  vi.clearAllMocks();
  from.mockReturnValue({ uploadToSignedUrl });
  uploadToSignedUrl.mockResolvedValue({ error: null });
});

describe("intake action payload", () => {
  it("sends strings and metadata only, even if the source has files under other names", () => {
    const file = pdf("scan.pdf");
    const original = new FormData();
    original.set("firstName", "Test");
    original.set("cf-turnstile-response", "test-only-verification");
    original.append("documents", file);
    original.append("unexpectedFile", file);
    original.append("documents", "not metadata");
    original.set("uploadManifest", "untrusted prior manifest");

    const result = intakeStartData(original, [file]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.payload.values()].every((value) => typeof value === "string")).toBe(true);
    expect(result.payload.has("documents")).toBe(false);
    expect(result.payload.has("unexpectedFile")).toBe(false);
    expect(result.payload.get("firstName")).toBe("Test");
    expect(result.payload.get("cf-turnstile-response")).toBe("test-only-verification");
    expect(JSON.parse(result.payload.get("uploadManifest") as string)).toEqual([
      { name: "scan.pdf", size: 12, mime: "application/pdf" },
    ]);
    expect(result.files[0]).toBe(file);
    expect(original.get("documents")).toBeInstanceOf(File);
  });

  it("keeps ten files at exactly 25 MiB without including their bytes", () => {
    const files = Array.from({ length: MAX_FILES }, (_, index) => pdf(`${index}.pdf`, MAX_FILE_BYTES));
    const result = intakeStartData(new FormData(), files);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const manifest = JSON.parse(result.payload.get("uploadManifest") as string);
    expect(manifest).toHaveLength(10);
    expect(manifest.every((file: { size: number }) => file.size === 26_214_400)).toBe(true);
    expect([...result.payload.entries()]).toHaveLength(1);
  });

  it.each([
    ["eleven files", () => Array.from({ length: 11 }, () => pdf())],
    ["one byte over the size limit", () => [pdf("large.pdf", MAX_FILE_BYTES + 1)]],
    ["an unsupported format", () => [new File(["x"], "code.exe", { type: "application/octet-stream" })]],
  ])("rejects %s before preparing an upload session", (_label, files) => {
    expect(intakeStartData(new FormData(), files()).ok).toBe(false);
  });

  it.each([[], [new File([], "", { type: "application/octet-stream" })]])(
    "supports no attachments and the empty native file-input value",
    (...files) => {
      const result = intakeStartData(new FormData(), files);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.payload.get("uploadManifest")).toBe("[]");
      expect(result.files).toEqual([]);
    },
  );
});

describe("issued upload capabilities", () => {
  it("requires exactly one matching entry for each original file index", () => {
    expect(intakeUploadsMatchFiles(session, [pdf()])).toBe(true);
    expect(intakeUploadsMatchFiles({ ...session, uploads: [] }, [pdf()])).toBe(false);
    expect(intakeUploadsMatchFiles({ ...session, uploads: [capability, capability] }, [pdf(), pdf()])).toBe(false);
    expect(intakeUploadsMatchFiles({ ...session, uploads: [{ ...capability, index: 1 }] }, [pdf()])).toBe(false);
    expect(intakeUploadsMatchFiles({ ...session, uploads: [{ ...capability, index: -1 }] }, [pdf()])).toBe(false);
    expect(intakeUploadsMatchFiles({ ...session, uploads: [{ ...capability, index: 0.5 }] }, [pdf()])).toBe(false);
    expect(intakeUploadsMatchFiles({ ...session, uploads: [{ ...capability, mime: "image/png" }] }, [pdf()])).toBe(false);
  });

  it("uploads the original File only to the issued private Storage path", async () => {
    const file = pdf();
    expect(await uploadIntakeFile(capability, file)).toBe(true);
    expect(from).toHaveBeenCalledWith("claim-docs");
    expect(uploadToSignedUrl).toHaveBeenCalledExactlyOnceWith(
      capability.path, capability.token, file, { contentType: "application/pdf", upsert: false },
    );
  });

  it.each(["400", "409"])("leaves upload status uncertain after a %s conflict", async (statusCode) => {
    uploadToSignedUrl.mockResolvedValue({ error: { statusCode, message: "Asset Already Exists" } });
    expect(await uploadIntakeFile(capability, pdf())).toBe(false);
  });

  it("does not return or log a provider error containing a capability", async () => {
    const logger = vi.spyOn(console, "error");
    uploadToSignedUrl.mockRejectedValue(new Error(`Request failed: ${capability.token}`));
    expect(await uploadIntakeFile(capability, pdf())).toBe(false);
    expect(logger).not.toHaveBeenCalled();
    logger.mockRestore();
  });
});
