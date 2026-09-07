import { describe, expect, it, vi } from "vitest";
import {
  removeExactQueuedObject,
  type StorageApi,
} from "./storage";

function storageWith(error: unknown | null) {
  const remove = vi.fn(async () => ({ error }));
  const from = vi.fn(() => ({ remove }));
  return { storage: { from } satisfies StorageApi, from, remove };
}

describe("removeExactQueuedObject", () => {
  it("passes one exact path to the exact queued bucket", async () => {
    const fake = storageWith(null);
    await removeExactQueuedObject(
      fake.storage,
      "claim-docs",
      "claims/a/document.pdf",
    );

    expect(fake.from).toHaveBeenCalledExactlyOnceWith("claim-docs");
    expect(fake.remove).toHaveBeenCalledExactlyOnceWith([
      "claims/a/document.pdf",
    ]);
  });

  it("treats the API's normal no-error result as success", async () => {
    const fake = storageWith(null);
    await expect(
      removeExactQueuedObject(fake.storage, "claim-docs", "gone.pdf"),
    ).resolves.toBeUndefined();
  });

  it("propagates a real Storage API failure", async () => {
    const failure = { statusCode: 503, message: "Storage unavailable" };
    const fake = storageWith(failure);
    await expect(
      removeExactQueuedObject(fake.storage, "claim-docs", "keep.pdf"),
    ).rejects.toBe(failure);
  });

  it("does not normalize a 404 or provider code into success", async () => {
    const http404 = { statusCode: 404, message: "Object not found" };
    const providerCode = { code: "ResourceNotFound", message: "gone" };
    await expect(
      removeExactQueuedObject(storageWith(http404).storage, "claim-docs", "gone.pdf"),
    ).rejects.toBe(http404);
    await expect(
      removeExactQueuedObject(storageWith(providerCode).storage, "claim-docs", "gone.pdf"),
    ).rejects.toBe(providerCode);
  });
});
