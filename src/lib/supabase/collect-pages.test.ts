import { describe, expect, it, vi } from "vitest";
import { collectPostgrestPages } from "./collect-pages";

describe("collectPostgrestPages", () => {
  it("reads the 1,001st row instead of accepting the implicit 1,000-row ceiling", async () => {
    const source = Array.from({ length: 1_001 }, (_, id) => ({ id }));
    const load = vi.fn((from: number, to: number) =>
      Promise.resolve({ data: source.slice(from, to + 1), error: null }),
    );

    const result = await collectPostgrestPages(load);

    expect(result).toEqual(source);
    expect(load.mock.calls).toEqual([
      [0, 999],
      [1_000, 1_999],
    ]);
  });

  it("throws on a second-page error without exposing the first page as complete", async () => {
    const failure = { message: "read failed" };
    await expect(
      collectPostgrestPages(
        (from) =>
          Promise.resolve(
            from === 0
              ? { data: [{ id: 1 }, { id: 2 }], error: null }
              : { data: null, error: failure },
          ),
        2,
      ),
    ).rejects.toThrow("PostgREST collection read failed: read failed");
  });

  it("throws when a full first page is followed by null data without an error", async () => {
    await expect(
      collectPostgrestPages(
        (from) =>
          Promise.resolve(
            from === 0
              ? { data: [{ id: 1 }, { id: 2 }], error: null }
              : { data: null, error: null },
          ),
        2,
      ),
    ).rejects.toThrow("PostgREST collection read failed: response data was not an array");
  });

  it("defensively rejects non-array data from an invalid client response", async () => {
    await expect(
      collectPostgrestPages(() =>
        Promise.resolve({ data: { id: 1 }, error: null } as unknown as {
          data: { id: number }[];
          error: null;
        }),
      ),
    ).rejects.toThrow("PostgREST collection read failed: response data was not an array");
  });

  it("rejects an invalid page size before issuing a request", async () => {
    const load = vi.fn(() => Promise.resolve({ data: [], error: null }));

    await expect(collectPostgrestPages(load, 0)).rejects.toThrow(RangeError);
    expect(load).not.toHaveBeenCalled();
  });
});
