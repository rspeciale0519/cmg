import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  privateFinalizeData,
  privateUploadStartData,
  privateUploadsMatchFiles,
  uploadPrivateFile,
  type PrivateUploadSession,
} from "./private-upload-client";

const { uploadToSignedUrl } = vi.hoisted(() => ({ uploadToSignedUrl: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl }) } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  uploadToSignedUrl.mockResolvedValue({ error: null });
});

function pdf(name = "scan.pdf") {
  return new File(["contents"], name, { type: "application/pdf" });
}

describe("private document upload payload", () => {
  it("sends metadata and string fields without sending file bytes", () => {
    const file = pdf();
    const source = new FormData();
    source.set("claimId", "claim-1");
    source.set("kind", "other");
    source.set("visibility", "customer");
    source.append("files", file);
    source.append("unexpected", file);
    const result = privateUploadStartData(source, [file]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.payload.values()].every((value) => typeof value === "string")).toBe(true);
    expect(result.payload.get("kind")).toBe("other");
    expect(result.payload.get("visibility")).toBe("customer");
    expect(result.payload.has("files")).toBe(false);
    expect(result.payload.has("unexpected")).toBe(false);
    expect(JSON.parse(String(result.payload.get("uploadManifest")))).toEqual([
      { name: "scan.pdf", size: file.size, mime: "application/pdf" },
    ]);
    expect(result.files).toEqual([file]);
  });

  it("rejects an invalid file selection before creating a session", () => {
    expect(privateUploadStartData(new FormData(), [new File(["x"], "bad.exe", { type: "application/octet-stream" })]).ok).toBe(false);
  });
});

describe("private upload capabilities", () => {
  const session: PrivateUploadSession = {
    id: "session", token: "secret", expiresAt: "2026-09-27T12:00:00Z",
    uploads: [{ index: 0, path: "claim/private/0", token: "upload-secret", mime: "application/pdf" }],
  };

  it("requires an exact file index and MIME match before sending bytes", () => {
    expect(privateUploadsMatchFiles(session, [pdf()])).toBe(true);
    expect(privateUploadsMatchFiles({ ...session, uploads: [] }, [pdf()])).toBe(false);
    expect(privateUploadsMatchFiles({ ...session, uploads: [{ ...session.uploads[0], index: 1 }] }, [pdf()])).toBe(false);
    expect(privateUploadsMatchFiles(session, [new File(["x"], "x.png", { type: "image/png" })])).toBe(false);
  });

  it("places finalization credentials in string FormData fields", () => {
    const data = privateFinalizeData(session);
    expect([...data.entries()]).toEqual([["id", "session"], ["token", "secret"]]);
  });

  it("logs only a safe HTTP status when Storage rejects an upload", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    uploadToSignedUrl.mockResolvedValueOnce({
      error: Object.assign(new Error("private path and upload-secret"), {
        status: 413,
        code: "EntityTooLarge",
      }),
    });
    expect(await uploadPrivateFile(session.uploads[0], pdf())).toBe(false);
    expect(warning).toHaveBeenCalledExactlyOnceWith("[private-upload] Storage upload failed", {
      status: 413,
      code: "EntityTooLarge",
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret");
  });

  it("sends a file at the configured 25 MiB limit to signed Storage upload", async () => {
    const file = pdf();
    Object.defineProperty(file, "size", { value: 26_214_400 });
    expect(await uploadPrivateFile(session.uploads[0], file)).toBe(true);
    expect(uploadToSignedUrl).toHaveBeenCalledExactlyOnceWith(
      "claim/private/0", "upload-secret", file,
      { contentType: "application/pdf", upsert: false },
    );
  });
});
