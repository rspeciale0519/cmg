// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { storageRangeReader } from "./storage-reader";

afterEach(() => vi.unstubAllGlobals());

describe("bounded private file range reads", () => {
  it("reads the exact range without caching or following redirects", async () => {
    const request = vi.fn(async () => new Response(new Uint8Array([4, 5, 6]), {
      status: 206, headers: { "content-range": "bytes 4-6/10" },
    }));
    vi.stubGlobal("fetch", request);
    expect(await storageRangeReader("https://storage.example.invalid/file", 10)(4, 6))
      .toEqual(new Uint8Array([4, 5, 6]));
    expect(request).toHaveBeenCalledWith("https://storage.example.invalid/file", expect.objectContaining({
      headers: { Range: "bytes=4-6" }, cache: "no-store", redirect: "error",
    }));
  });

  it("accepts a whole small file response when every byte was requested", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("PDF", { status: 200 })));
    expect(await storageRangeReader("https://storage.example.invalid/file", 3)(0, 2))
      .toEqual(new TextEncoder().encode("PDF"));
  });

  it.each([
    { status: 200, range: null, body: "too much data", size: 100 },
    { status: 206, range: "bytes 0-2/99", body: "PDF", size: 100 },
    { status: 206, range: "bytes 0-2/100", body: "PD", size: 100 },
    { status: 206, range: "bytes 0-2/100", body: "PDFextra", size: 100 },
  ])("refuses ignored, inconsistent, truncated, or excessive ranges", async ({ status, range, body, size }) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, {
      status, headers: range ? { "content-range": range } : {},
    })));
    await expect(storageRangeReader("https://storage.example.invalid/file", size)(0, 2)).rejects.toThrow();
  });

  it.each([[-1, 2], [2, 1], [0, 10], [0.5, 2]])("refuses an invalid range before fetching", async (start, end) => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    await expect(storageRangeReader("https://storage.example.invalid/file", 10)(start, end)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
