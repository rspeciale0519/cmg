import { describe, expect, it, vi } from "vitest";
import { allocatePrivateUploadManifest, parsePrivateUploadManifest } from "./manifest";

vi.mock("server-only", () => ({}));

const claimId = "20000000-0000-4000-a000-0000000000c1";
const sessionId = "30000000-0000-4000-a000-0000000000c1";
const metadata = [{ name: "roof/photo.jpg", size: 25, mime: "IMAGE/JPEG; charset=binary" }];

describe("private document upload manifest", () => {
  it("accepts only bounded metadata and refuses multipart bytes", () => {
    const data = new FormData();
    data.set("claimId", claimId);
    data.set("uploadManifest", JSON.stringify(metadata));
    expect(parsePrivateUploadManifest(data)).toEqual([
      { name: "roof/photo.jpg", size: 25, mime: "image/jpeg" },
    ]);

    data.append("files", new File(["bytes"], "photo.jpg", { type: "image/jpeg" }));
    expect(parsePrivateUploadManifest(data)).toBeNull();
  });

  it("rejects unsafe MIME names, oversized manifests, and out-of-range file sizes", () => {
    const data = new FormData();
    data.set("uploadManifest", JSON.stringify([{ name: "a", size: 1, mime: "constructor" }]));
    expect(parsePrivateUploadManifest(data)).toBeNull();
    data.set("uploadManifest", JSON.stringify([{ name: "a", size: 26_214_401, mime: "image/jpeg" }]));
    expect(parsePrivateUploadManifest(data)).toBeNull();
    data.set("uploadManifest", " ".repeat(8_193));
    expect(parsePrivateUploadManifest(data)).toBeNull();
  });

  it("allocates unrelated staging and immutable claim paths with canonical UUID names", () => {
    const parsed = parsePrivateUploadManifest(new FormData());
    const form = new FormData();
    form.set("uploadManifest", JSON.stringify(metadata));
    const files = allocatePrivateUploadManifest(sessionId, claimId, parsePrivateUploadManifest(form)!, "photo", "customer");

    expect(parsed).toBeNull();
    expect(files).toHaveLength(1);
    expect(files[0].upload_path).toMatch(new RegExp(`^private-upload/${sessionId}/[0-9a-f-]{36}\\.jpg$`));
    expect(files[0].storage_path).toMatch(new RegExp(`^claims/${claimId}/[0-9a-f-]{36}\\.jpg$`));
    expect(files[0].upload_path).not.toBe(files[0].storage_path);
    expect(files[0].original_name).toBe("photo.jpg");
    expect(files[0].visibility).toBe("customer");
  });
});
