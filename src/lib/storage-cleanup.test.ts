// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";

vi.mock("server-only", () => ({}));

const { registerCleanupIntent, removeOrQueueExact } = await import("./storage-cleanup");
const paths = ["claims/test/attached.pdf", "claims/test/orphan.pdf"];
const rpc = vi.fn();
const remove = vi.fn();
const admin = {
  rpc,
  storage: { from: vi.fn(() => ({ remove })) },
} as unknown as SupabaseClient<Database>;

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: 1, error: null });
  remove.mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("deferred exact storage cleanup", () => {
  it("leaves bytes in Storage and queues only the supplied object paths", async () => {
    await removeOrQueueExact(admin, "claim-docs", paths, "claim-id");

    expect(remove).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("enqueue_storage_cleanup_exact", {
      p_bucket_id: "claim-docs",
      p_object_paths: paths,
      p_claim_id: "claim-id",
    });
  });

  it("does no work for an empty path list", async () => {
    await removeOrQueueExact(admin, "claim-docs", []);

    expect(remove).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps a failed enqueue visible without exposing provider data", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private-provider-data" } });

    await expect(removeOrQueueExact(admin, "claim-docs", paths)).resolves.toBeUndefined();

    expect(remove).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[storage] durable cleanup enqueue failed");
  });

  it("does not replace the caller's error when an enqueue request throws", async () => {
    rpc.mockRejectedValue(new Error("private-provider-data"));

    await expect(removeOrQueueExact(admin, "claim-docs", paths)).resolves.toBeUndefined();

    expect(remove).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[storage] durable cleanup enqueue failed");
  });

  it("reports failed intent reservation without exposing provider data", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private-provider-data" } });

    expect(await registerCleanupIntent(admin, "claim-docs", paths[0])).toBe(false);
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[storage] cleanup intent failed");
  });
});
