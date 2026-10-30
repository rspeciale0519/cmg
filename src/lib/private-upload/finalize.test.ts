import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";
import { describe, expect, it, vi } from "vitest";
import { finalizePrivateUploadSession } from "./finalize";
import { parsePrivateUploadCapability, privateUploadTokenHash } from "./session";

vi.mock("server-only", () => ({}));

const id = "30000000-0000-4000-a000-0000000000c1";
const claimId = "20000000-0000-4000-a000-0000000000c1";
const userId = "00000000-0000-4000-a000-000000000009";
const documentId = "40000000-0000-4000-a000-0000000000c1";
const token = "A".repeat(43);

describe("private upload capability form parsing", () => {
  it("accepts the capability from FormData fields", () => {
    const form = new FormData();
    form.set("id", id);
    form.set("token", token);

    expect(parsePrivateUploadCapability(form)).toEqual({ id, token });
  });

  it("rejects a file part so capabilities cannot be mixed with upload bytes", () => {
    const form = new FormData();
    form.set("id", id);
    form.set("token", token);
    form.set("unexpected", new File(["x"], "payload.txt"));

    expect(parsePrivateUploadCapability(form)).toBeNull();
  });
});

const file = {
  index: 0,
  upload_path: `private-upload/${id}/50000000-0000-4000-a000-0000000000c1.pdf`,
  storage_path: `claims/${claimId}/60000000-0000-4000-a000-0000000000c1.pdf`,
  original_name: "roof.pdf",
  kind: "photo",
  visibility: "customer",
  mime: "application/pdf",
  size_bytes: 9,
  copy_started_at: "2026-09-27T12:00:00.000Z",
  verification: {
    index: 0,
    object_id: "70000000-0000-4000-a000-0000000000c1",
    version: "1",
    mime: "application/pdf",
    size_bytes: 9,
  },
};
const row = {
  id: documentId,
  claim_id: claimId,
  storage_path: file.storage_path,
  original_name: file.original_name,
  kind: file.kind,
  mime: file.mime,
  size_bytes: file.size_bytes,
  uploaded_by: userId,
  visibility: file.visibility,
};

function adminClient(finalizeCalls: Array<[string, unknown]>, expired = true) {
  return {
    from: (table: string) => {
      if (table === "private_upload_sessions") return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({
          data: { id, claim_id: claimId, uploaded_by: userId, status: "pending", result: null, expires_at: new Date(Date.now() + (expired ? -1_000 : 60_000)).toISOString() },
          error: null,
        }) }) }) }),
      };
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: [file], error: null }) }) }),
      };
    },
    rpc: async (name: string, args: unknown) => {
      if (name === "cancel_private_upload_session") {
        return { data: { status: "cancelled" }, error: null };
      }
      finalizeCalls.push([name, args]);
      return { data: { documents: [{ id: documentId, storage_path: file.storage_path }] }, error: null };
    },
    storage: { from: vi.fn(() => ({})) },
  } as unknown as SupabaseClient<Database>;
}

function callerClient(rows: typeof row[]) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ in: async () => ({ data: rows, error: null }) }) }),
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("private upload finalization recovery", () => {
  it("settles an expired session only when every exact document row already exists", async () => {
    const finalizeCalls: Array<[string, unknown]> = [];
    const result = await finalizePrivateUploadSession(
      adminClient(finalizeCalls), callerClient([row]), id, token, userId, claimId,
    );

    expect(result.status).toBe("success");
    expect(finalizeCalls).toEqual([["finalize_private_upload_session", {
      p_id: id, p_token_hash: privateUploadTokenHash(token), p_document_ids: [documentId],
    }]]);
  });

  it("does not settle an expired session when a reserved document is missing", async () => {
    const finalizeCalls: Array<[string, unknown]> = [];
    const result = await finalizePrivateUploadSession(
      adminClient(finalizeCalls), callerClient([]), id, token, userId, claimId,
    );

    expect(result.status).toBe("error");
    expect(finalizeCalls).toEqual([]);
  });
});

describe("private upload uncertain insert recovery", () => {
  it.each([
    ["matching", row, "success", 1],
    ["mismatched uploader", { ...row, uploaded_by: "00000000-0000-4000-a000-000000000008" }, "error", 0],
  ])("settles only a %s document after an insert error", async (_label, reread, expectedStatus, finalizeCount) => {
    const finalizeCalls: Array<[string, unknown]> = [];
    const read = vi.fn()
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [reread], error: null });
    const selectPaths = vi.fn(() => ({ in: read }));
    const select = vi.fn(() => ({ eq: selectPaths }));
    const inserted = vi.fn(async () => ({ data: null, error: { message: "response lost" } }));
    const insert = vi.fn(() => ({ select: inserted }));
    const caller = {
      from: vi.fn(() => ({ select, insert })),
    } as unknown as SupabaseClient<Database>;
    const admin = adminClient(finalizeCalls, false);
    const rpc = vi.spyOn(admin, "rpc");

    const result = await finalizePrivateUploadSession(
      admin, caller, id, token, userId, claimId,
    );

    expect(result.status).toBe(expectedStatus);
    expect(result.restartAllowed).not.toBe(true);
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("cancel_private_upload_session");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveBeenCalledTimes(1);
    expect(selectPaths).toHaveBeenCalledTimes(2);
    expect(selectPaths).toHaveBeenNthCalledWith(1, "claim_id", claimId);
    expect(selectPaths).toHaveBeenNthCalledWith(2, "claim_id", claimId);
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenNthCalledWith(1, "storage_path", [file.storage_path]);
    expect(read).toHaveBeenNthCalledWith(2, "storage_path", [file.storage_path]);
    expect(finalizeCalls).toHaveLength(finalizeCount);
    if (finalizeCount) {
      expect(finalizeCalls[0]).toEqual(["finalize_private_upload_session", {
        p_id: id, p_token_hash: privateUploadTokenHash(token), p_document_ids: [documentId],
      }]);
    }
  });
});

describe("thrown insert response recovery", () => {
  it.each([
    ["matching row", row, "success", 1],
    ["mismatched uploader", { ...row, uploaded_by: "00000000-0000-4000-a000-000000000008" }, "error", 0],
  ])("reconciles only a %s after an insert throws", async (_label, committedRow, expectedStatus, finalizations) => {
    const finalizeCalls: Array<[string, unknown]> = [];
    const read = vi.fn().mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [committedRow], error: null });
    const select = vi.fn(() => ({ eq: () => ({ in: read }) }));
    const insertResponse = vi.fn().mockRejectedValueOnce(new Error("synthetic lost response"));
    const insert = vi.fn(() => ({ select: insertResponse }));
    const caller = { from: vi.fn(() => ({ select, insert })) } as unknown as SupabaseClient<Database>;
    const admin = adminClient(finalizeCalls, false);
    const rpc = vi.spyOn(admin, "rpc");
    await expect(finalizePrivateUploadSession(admin, caller, id, token, userId, claimId))
      .rejects.toThrow("synthetic lost response");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(finalizeCalls).toHaveLength(0);
    const result = await finalizePrivateUploadSession(admin, caller, id, token, userId, claimId);
    expect(result.status).toBe(expectedStatus);
    expect(result.restartAllowed).not.toBe(true);
    expect(read).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(finalizeCalls).toHaveLength(finalizations);
    expect(rpc.mock.calls.map(([name]) => name)).not.toContain("cancel_private_upload_session");
    if (finalizations) expect(finalizeCalls[0]).toEqual(["finalize_private_upload_session", {
      p_id: id, p_token_hash: privateUploadTokenHash(token), p_document_ids: [documentId],
    }]);
  });
});
