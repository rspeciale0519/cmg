// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";
import type { IntakeManifestFile } from "./manifest";

const stub = vi.hoisted(() => ({
  signature: vi.fn(async () => true),
  reader: vi.fn(() => async () => new Uint8Array()),
}));
vi.mock("server-only", () => ({}));
vi.mock("./file-signatures", () => ({ verifyFileSignature: stub.signature }));
vi.mock("./storage-reader", () => ({ storageRangeReader: stub.reader }));
import { verifyIntakeFiles } from "./verified-files";

const manifest: IntakeManifestFile = {
  index: 0,
  upload_path: "intake/20000000-0000-4000-a000-000000000001/upload.pdf",
  storage_path: "intake/20000000-0000-4000-a000-000000000001/document.pdf",
  original_name: "roof.pdf", mime: "application/pdf", size_bytes: 64,
};
const stored = { id: "20000000-0000-4000-a000-000000000002", version: "version-1", size: 64, contentType: "application/pdf" };

function storageFixture(options: { source?: boolean; destination?: boolean; size?: number; copyResponseLost?: boolean } = {}) {
  let destination = options.destination ?? false;
  let verification: unknown = null;
  const storage = {
    info: vi.fn(async (path: string) => ({
      data: (path === manifest.storage_path ? destination : options.source !== false)
        ? { ...stored, size: options.size ?? 64 } : null,
      error: null,
    })),
    copy: vi.fn(async () => {
      destination = true;
      return { data: null, error: options.copyResponseLost ? { message: "response unavailable" } : null };
    }),
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: `https://fixture.supabase.co/storage/v1/object/sign/claim-docs/${manifest.storage_path}?token=fixture` },
      error: null,
    })),
  };
  const admin = {
    storage: { from: () => storage },
    rpc: vi.fn(async () => ({ data: { allowed: true, copy_started_at: new Date().toISOString() }, error: null })),
    from: vi.fn(() => ({
      update: vi.fn((value: { verification?: unknown }) => {
        verification = value.verification ?? null;
        return { eq: () => ({ eq: () => ({ is: async () => ({ error: null }) }) }) };
      }),
      select: vi.fn(() => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { verification }, error: null }) }) }) })),
    })),
  } as unknown as SupabaseClient<Database>;
  return { admin, storage };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
  stub.signature.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("immutable intake document copies", () => {
  it("validates the copied document and returns its exact stored version", async () => {
    const { admin, storage } = storageFixture();
    const result = await verifyIntakeFiles(admin, [manifest]);
    expect(result).toEqual({ ok: true, files: [{
      index: 0, object_id: stored.id, version: stored.version, mime: manifest.mime, size_bytes: 64,
    }], pending: 0 });
    expect(storage.copy).toHaveBeenCalledWith(manifest.upload_path, manifest.storage_path);
    expect(storage.createSignedUrl).toHaveBeenCalledWith(manifest.storage_path, 300);
    expect(stub.signature.mock.invocationCallOrder[0]).toBeGreaterThan(storage.copy.mock.invocationCallOrder[0]);
  });

  it("reuses the destination when an earlier copy response was lost", async () => {
    const { admin, storage } = storageFixture({ source: false, destination: true });
    expect((await verifyIntakeFiles(admin, [manifest])).ok).toBe(true);
    expect(storage.copy).not.toHaveBeenCalled();
    expect(storage.info).not.toHaveBeenCalledWith(manifest.upload_path);
  });

  it("reconciles a successful copy despite a failed copy response", async () => {
    const { admin } = storageFixture({ copyResponseLost: true });
    expect((await verifyIntakeFiles(admin, [manifest])).ok).toBe(true);
  });

  it("keeps an incomplete upload retryable", async () => {
    const { admin, storage } = storageFixture({ source: false });
    expect(await verifyIntakeFiles(admin, [manifest])).toEqual({ ok: false, invalid: false });
    expect(storage.copy).not.toHaveBeenCalled();
  });

  it("rejects a stored size that differs from the manifest", async () => {
    const { admin, storage } = storageFixture({ size: 65 });
    expect(await verifyIntakeFiles(admin, [manifest])).toEqual({ ok: false, invalid: true });
    expect(storage.copy).not.toHaveBeenCalled();
  });

  it("distinguishes an invalid signature from a failed Storage read", async () => {
    const { admin } = storageFixture({ destination: true });
    stub.signature.mockResolvedValueOnce(false);
    expect(await verifyIntakeFiles(admin, [manifest])).toEqual({ ok: false, invalid: true });
    stub.signature.mockRejectedValueOnce(new Error("range unavailable"));
    await expect(verifyIntakeFiles(admin, [manifest])).rejects.toThrow("range unavailable");
  });

  it("does not fetch a signed response URL on another origin", async () => {
    const { admin, storage } = storageFixture({ destination: true });
    storage.createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: "https://other.example.invalid/file" }, error: null });
    await expect(verifyIntakeFiles(admin, [manifest])).rejects.toThrow("File verification URL unavailable");
    expect(stub.reader).not.toHaveBeenCalled();
  });
});
