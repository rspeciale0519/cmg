// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredPrivateUploadFile } from "./session";

vi.mock("server-only", () => ({}));

import { verifyPrivateUploadFiles } from "./verified-files";

const sessionId = "30000000-0000-4000-a000-0000000000c1";
const claimId = "20000000-0000-4000-a000-0000000000c1";
const token = "A".repeat(43);
const file: StoredPrivateUploadFile = {
  index: 0,
  upload_path: `private-upload/${sessionId}/50000000-0000-4000-a000-0000000000c1.pdf`,
  storage_path: `claims/${claimId}/60000000-0000-4000-a000-0000000000c1.pdf`,
  original_name: "roof.pdf",
  kind: "photo",
  visibility: "customer",
  mime: "application/pdf",
  size_bytes: 64,
  verification: null,
  copy_started_at: null,
};
type StorageInfo = { id: string; version: string; size: number; contentType: string };
const object: StorageInfo = {
  id: "70000000-0000-4000-a000-0000000000c1",
  version: "version-1",
  size: file.size_bytes,
  contentType: file.mime,
};
const validPdf = new Uint8Array(file.size_bytes);
validPdf.set(new TextEncoder().encode("%PDF-1.7\n"));
const invalidPdf = new Uint8Array(file.size_bytes);
invalidPdf.set(new TextEncoder().encode("not a pdf"));

type Options = {
  source?: StorageInfo | null;
  destination?: StorageInfo | null;
  sourceError?: unknown;
  destinationError?: unknown;
  signedUrlError?: unknown;
  copyResponseLost?: boolean;
  updateError?: unknown;
  persistProof?: boolean;
};

function fixture(options: Options = {}) {
  let destination = options.destination ?? null;
  let savedProof: unknown = null;
  const storage = {
    info: vi.fn(async (path: string) => {
      if (path === file.storage_path) return { data: destination, error: options.destinationError ?? null };
      return { data: options.source === undefined ? object : options.source, error: options.sourceError ?? null };
    }),
    copy: vi.fn(async () => {
      destination = object;
      return { data: null, error: options.copyResponseLost ? { message: "response lost" } : null };
    }),
    createSignedUrl: vi.fn(async () => ({
      data: options.signedUrlError ? null : {
        signedUrl: `https://fixture.supabase.co/storage/v1/object/sign/claim-docs/${file.storage_path}?token=fixture`,
      },
      error: options.signedUrlError ?? null,
    })),
  };
  const admin = {
    storage: { from: () => storage },
    rpc: vi.fn(async () => ({
      data: { allowed: true, copy_started_at: "2026-10-19T12:00:00.000Z" }, error: null,
    })),
    from: vi.fn(() => ({
      update: vi.fn((value: { verification: unknown }) => ({
        eq: () => ({ eq: () => ({ is: async () => {
          if (!options.updateError && options.persistProof !== false) savedProof = value.verification;
          return { error: options.updateError ?? null };
        } }) }),
      })),
      select: vi.fn(() => ({
        eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { verification: savedProof }, error: null }) }) }),
      })),
    })),
  } as unknown as SupabaseClient<Database>;
  return { admin, storage, get savedProof() { return savedProof; } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("Unexpected network request in private upload test.");
  }));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function serveBytes(bytes: Uint8Array) {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const range = new Headers(init?.headers).get("Range");
    const match = range?.match(/^bytes=(\d+)-(\d+)$/);
    if (!match) throw new Error("The verifier did not request a byte range.");
    const start = Number(match[1]);
    const end = Number(match[2]);
    return new Response(bytes.slice(start, end + 1), {
      status: 206,
      headers: { "content-range": `bytes ${start}-${end}/${bytes.length}` },
    });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("private upload byte verification", () => {
  it("saves the exact object proof only when the copied PDF bytes pass", async () => {
    const state = fixture();
    const fetcher = serveBytes(validPdf);

    const result = await verifyPrivateUploadFiles(state.admin, sessionId, token, [file]);

    expect(result).toEqual({ ok: true, pending: 0 });
    expect(state.savedProof).toEqual({
      index: 0,
      object_id: object.id,
      version: object.version,
      mime: file.mime,
      size_bytes: file.size_bytes,
    });
    expect(state.storage.copy).toHaveBeenCalledWith(file.upload_path, file.storage_path);
    expect(fetcher).toHaveBeenCalled();
  });

  it.each([
    ["staged size", { source: { ...object, size: file.size_bytes + 1 } }],
    ["staged MIME", { source: { ...object, contentType: "image/png" } }],
    ["permanent size", { destination: { ...object, size: file.size_bytes + 1 } }],
    ["permanent MIME", { destination: { ...object, contentType: "image/png" } }],
  ] as const)("rejects %s metadata without saving a proof", async (_label, options) => {
    const state = fixture(options);

    const result = await verifyPrivateUploadFiles(state.admin, sessionId, token, [file]);

    expect(result).toEqual({ ok: false, invalid: true });
    expect(state.storage.copy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(state.savedProof).toBeNull();
  });

  it("does not save a proof when the copied content has a bad PDF signature", async () => {
    const state = fixture();
    const fetcher = serveBytes(invalidPdf);

    const result = await verifyPrivateUploadFiles(state.admin, sessionId, token, [file]);

    expect(result).toEqual({ ok: false, invalid: true });
    expect(fetcher).toHaveBeenCalled();
    expect(state.savedProof).toBeNull();
  });

  it.each(["id", "version"])("keeps a missing destination %s unverified", async (field) => {
    const state = fixture({ destination: { ...object, [field]: "" } });

    const result = await verifyPrivateUploadFiles(state.admin, sessionId, token, [file]);

    expect(result).toEqual({ ok: false, invalid: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(state.savedProof).toBeNull();
  });

  it.each([
    ["source metadata", { sourceError: { status: 503 } }],
    ["destination metadata", { destinationError: { status: 503 }, destination: object }],
    ["signed range URL", { signedUrlError: { status: 503 }, destination: object }],
  ] as const)("leaves unavailable %s retryable without saving proof", async (_label, options) => {
    const state = fixture(options);

    const result = await verifyPrivateUploadFiles(state.admin, sessionId, token, [file]);

    expect(result).toEqual({ ok: false, invalid: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(state.savedProof).toBeNull();
  });

  it("does not save proof when the real range reader rejects the Storage response", async () => {
    const state = fixture({ destination: object });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

    await expect(verifyPrivateUploadFiles(state.admin, sessionId, token, [file]))
      .rejects.toThrow("File verification response unavailable.");
    expect(state.savedProof).toBeNull();
  });

  it.each([
    ["a foreign origin", `https://other.example.invalid/storage/v1/object/sign/claim-docs/${file.storage_path}?token=fixture`],
    ["embedded credentials", `https://fixture-user:fixture-password@fixture.supabase.co/storage/v1/object/sign/claim-docs/${file.storage_path}?token=fixture`],
    ["a different object path", "https://fixture.supabase.co/storage/v1/object/sign/claim-docs/claims/another.pdf?token=fixture"],
  ] as const)("refuses a signed URL with %s before fetching bytes", async (_label, signedUrl) => {
    const state = fixture({ destination: object });
    state.storage.createSignedUrl.mockResolvedValue({ data: { signedUrl }, error: null });

    await expect(verifyPrivateUploadFiles(state.admin, sessionId, token, [file]))
      .rejects.toThrow("Private upload verification URL is invalid.");
    expect(fetch).not.toHaveBeenCalled();
    expect(state.savedProof).toBeNull();
  });

  it("reconciles a lost copy response from the permanent object before verifying it", async () => {
    const state = fixture({ copyResponseLost: true });
    const fetcher = serveBytes(validPdf);

    const result = await verifyPrivateUploadFiles(state.admin, sessionId, token, [file]);

    expect(result).toEqual({ ok: true, pending: 0 });
    expect(state.savedProof).not.toBeNull();
    expect(fetcher).toHaveBeenCalled();
  });

  it("does not accept verification when Storage refuses to save the proof", async () => {
    const state = fixture({ updateError: { message: "write refused" }, destination: object });
    serveBytes(validPdf);

    await expect(verifyPrivateUploadFiles(state.admin, sessionId, token, [file]))
      .rejects.toThrow("Private upload verification could not be saved.");
    expect(state.savedProof).toBeNull();
  });

  it("does not accept an acknowledged proof write that is absent on readback", async () => {
    const state = fixture({ destination: object, persistProof: false });
    serveBytes(validPdf);

    await expect(verifyPrivateUploadFiles(state.admin, sessionId, token, [file]))
      .rejects.toThrow("Private upload verification was not confirmed.");
    expect(state.savedProof).toBeNull();
  });

  it.each([
    ["an invalid object identity", { object_id: "not-a-uuid" }],
    ["another file index", { index: file.index + 1 }],
    ["another MIME type", { mime: "image/png" }],
    ["another file size", { size_bytes: file.size_bytes + 1 }],
  ] as const)("refuses a stored proof with %s before using Storage", async (_label, override) => {
    const state = fixture();
    const proof = {
      index: file.index,
      object_id: object.id,
      version: object.version,
      mime: file.mime,
      size_bytes: file.size_bytes,
      ...override,
    };

    await expect(verifyPrivateUploadFiles(state.admin, sessionId, token, [{ ...file, verification: proof }]))
      .rejects.toThrow("Stored private upload verification is malformed.");
    expect(state.storage.info).not.toHaveBeenCalled();
    expect(state.storage.copy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(state.savedProof).toBeNull();
  });

  it("reuses a saved proof when confirmation is retried", async () => {
    const proof = {
      index: 0,
      object_id: object.id,
      version: object.version,
      mime: file.mime,
      size_bytes: file.size_bytes,
    };
    const state = fixture();

    const result = await verifyPrivateUploadFiles(state.admin, sessionId, token, [{ ...file, verification: proof }]);

    expect(result).toEqual({ ok: true, pending: 0 });
    expect(state.storage.info).not.toHaveBeenCalled();
    expect(state.storage.copy).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
