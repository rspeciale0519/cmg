import { describe, expect, it, vi } from "vitest";
import { sweepStorageCleanup } from "./queue";

vi.mock("server-only", () => ({}));

type Admin = Parameters<typeof sweepStorageCleanup>[0];

describe("private upload cleanup reconciliation", () => {
  it("reconciles late private objects before claiming cleanup work", async () => {
    const names: string[] = [];
    const rpc = vi.fn(async (name: string) => {
      names.push(name);
      return { data: name === "claim_storage_cleanup_batch" ? [] : { blocked: 0 }, error: null };
    });
    const admin = { rpc, storage: {} } as unknown as Admin;

    await expect(sweepStorageCleanup(admin, 12)).resolves.toEqual({
      claimed: 0, processed: 0, failed: 0, dead: 0,
    });
    expect(names).toEqual([
      "reconcile_intake_upload_cleanup",
      "reconcile_private_upload_cleanup",
      "claim_storage_cleanup_batch",
    ]);
  });

  it("does not claim cleanup work when private reconciliation fails", async () => {
    const rpc = vi.fn(async (name: string) => ({
      data: { blocked: 0 },
      error: name === "reconcile_private_upload_cleanup" ? { message: "database unavailable" } : null,
    }));
    const admin = { rpc, storage: {} } as unknown as Admin;

    await expect(sweepStorageCleanup(admin, 12)).rejects.toThrow("Private upload cleanup reconciliation failed.");
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "reconcile_intake_upload_cleanup",
      "reconcile_private_upload_cleanup",
    ]);
  });
});
