// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readPackageFile } from "./package-file-reader";

describe("bounded package file reads", () => {
  it.each([{ status: 403 }, { headers: { "content-length": "9" } }])("cancels the body after an early response refusal", async (options) => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    await expect(readPackageFile(new Response(stream, options), 1)).rejects.toThrow();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it("keeps exact bytes across response chunks", async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3])); controller.close();
    } });
    expect(await readPackageFile(new Response(stream), 3)).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("rejects oversized, truncated, and declared-size mismatch responses", async () => {
    await expect(readPackageFile(new Response(new Uint8Array([1, 2, 3])), 2)).rejects.toThrow("changed");
    await expect(readPackageFile(new Response(new Uint8Array([1])), 2)).rejects.toThrow("incomplete");
    await expect(readPackageFile(new Response(new Uint8Array([1]), { headers: { "content-length": "9" } }), 1)).rejects.toThrow("changed");
  });
  it("rejects server errors and cancelled reads", async () => {
    await expect(readPackageFile(new Response("refused", { status: 403 }), 7)).rejects.toThrow("unavailable");
    const controller = new AbortController(); controller.abort();
    await expect(readPackageFile(new Response(new Uint8Array([1])), 1, controller.signal)).rejects.toThrow();
  });
});
