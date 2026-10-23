import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  claim: { id: "20000000-0000-4000-a000-0000000000c1", claim_ref: "CMG-2026-0207" },
  session: { userId: "00000000-0000-4000-a000-000000000009", email: "customer@cmg.test" },
  cleanupIntents: [] as string[],
  objectWrites: [] as string[],
  rowBatches: [] as Array<Array<{ storage_path: string }>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/audit", () => ({ writeAuditStrict: vi.fn(async () => {}) }));
vi.mock("@/lib/authz", () => ({
  requireStaff: vi.fn(async () => stub.session),
  requireRole: vi.fn(async () => stub.session),
}));
vi.mock("@/lib/private-upload/rate-limit", () => ({
  checkPrivateUploadPrepareLimit: vi.fn(async () => true),
  checkPrivateUploadFinalizeLimit: vi.fn(async () => true),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: async (_name: string, args: { p_object_paths?: string[] }) => {
      stub.cleanupIntents.push(...(args.p_object_paths ?? []));
      return { data: 1, error: null };
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          stub.objectWrites.push(path);
          return { error: null };
        },
      }),
    },
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: table === "claims" ? stub.claim : null, error: null }) }),
      }),
      insert: (rows: Array<{ storage_path: string }>) => ({
        select: async () => {
          stub.rowBatches.push(rows);
          return { data: rows.map((_, index) => ({ id: `row-${index}` })), error: null };
        },
      }),
    }),
  })),
}));

import { uploadClaimDocument } from "./documents";
import { uploadPortalDocument } from "./portal-documents";
import { idleState } from "./types";

const VALID_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const SPOOFED_JPEG = new TextEncoder().encode("not a jpeg");

const surfaces = [
  {
    name: "staff",
    action: uploadClaimDocument,
    fields: { claimId: "20000000-0000-4000-a000-0000000000c1", kind: "photo", visibility: "internal" },
  },
  {
    name: "portal",
    action: uploadPortalDocument,
    fields: { claimId: "20000000-0000-4000-a000-0000000000c1", kind: "photo" },
  },
] as const;

function jpg(name: string, bytes: Uint8Array): File {
  const content = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([content], name, { type: "image/jpeg" });
}

function form(fields: Record<string, string>, files: File[]): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  for (const file of files) data.append("files", file);
  return data;
}

beforeEach(() => {
  stub.cleanupIntents = [];
  stub.objectWrites = [];
  stub.rowBatches = [];
});

afterEach(() => vi.restoreAllMocks());

describe.each(surfaces)("legacy $name document upload signature validation", ({ action, fields }) => {
  it("rejects a JPEG MIME type when the bytes are not a JPEG", async () => {
    const result = await action(idleState, form(fields, [jpg("spoof.jpg", SPOOFED_JPEG)]));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.files).toBeTruthy();
    expect(result.message).not.toContain("spoof.jpg");
    expect(result.message).not.toContain("not a jpeg");
    expect(stub.cleanupIntents).toEqual([]);
    expect(stub.objectWrites).toEqual([]);
    expect(stub.rowBatches).toEqual([]);
  });

  it("checks every file before any file in the batch is written", async () => {
    const result = await action(idleState, form(fields, [
      jpg("valid.jpg", VALID_JPEG),
      jpg("spoof.jpg", SPOOFED_JPEG),
    ]));

    expect(result.status).toBe("error");
    expect(stub.cleanupIntents).toEqual([]);
    expect(stub.objectWrites).toEqual([]);
    expect(stub.rowBatches).toEqual([]);
  });

  it("fails closed when the server cannot read a file's bytes", async () => {
    vi.spyOn(File.prototype, "slice").mockImplementation(() => ({
      arrayBuffer: async () => { throw new DOMException("Read failed", "NotReadableError"); },
    }) as unknown as Blob);

    const result = await action(idleState, form(fields, [jpg("unreadable.jpg", VALID_JPEG)]));

    expect(result.status).toBe("error");
    expect(stub.cleanupIntents).toEqual([]);
    expect(stub.objectWrites).toEqual([]);
    expect(stub.rowBatches).toEqual([]);
  });

  it("stores files with valid JPEG signatures", async () => {
    const result = await action(idleState, form(fields, [jpg("valid.jpg", VALID_JPEG)]));

    expect(result.status).toBe("success");
    expect(stub.cleanupIntents).toHaveLength(1);
    expect(stub.objectWrites).toHaveLength(1);
    expect(stub.rowBatches).toHaveLength(1);
  });
});
