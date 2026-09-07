import { describe, expect, it, vi } from "vitest";
import {
  CLEANUP_MAX_ATTEMPTS,
  cleanupOutcomeAfterFailure,
  drainStorageCleanup,
  type CleanupClaim,
  type CleanupFailure,
  type CleanupStore,
} from "./processor";

function claim(id: number, attempts = 1): CleanupClaim {
  return {
    id,
    attempts,
    bucket_id: "claim-docs",
    object_path: `claims/example/${id}.pdf`,
  };
}

function store(rows: CleanupClaim[]) {
  const successes: CleanupClaim[] = [];
  const failures: CleanupFailure[] = [];
  const cleanupStore: CleanupStore = {
    claim: vi.fn(async () => rows),
    settleSuccess: vi.fn(async (row) => {
      successes.push(row);
    }),
    settleFailure: vi.fn(async (failure) => {
      failures.push(failure);
    }),
  };
  return { cleanupStore, successes, failures };
}

describe("cleanupOutcomeAfterFailure", () => {
  it("backs off the first four attempts and stops after the fifth", () => {
    expect(cleanupOutcomeAfterFailure(1)).toEqual({
      outcome: "failed",
      retryInSeconds: 60,
    });
    expect(cleanupOutcomeAfterFailure(4)).toEqual({
      outcome: "failed",
      retryInSeconds: 7500,
    });
    expect(cleanupOutcomeAfterFailure(CLEANUP_MAX_ATTEMPTS)).toEqual({
      outcome: "dead",
      retryInSeconds: null,
    });
  });
});

describe("drainStorageCleanup", () => {
  it("deletes only the exact bucket and path returned by the claim", async () => {
    const row = claim(7);
    const state = store([row]);
    const remove = vi.fn(async () => {});

    await expect(
      drainStorageCleanup(state.cleanupStore, remove, 25),
    ).resolves.toEqual({ claimed: 1, processed: 1, failed: 0, dead: 0 });

    expect(remove).toHaveBeenCalledExactlyOnceWith(row.bucket_id, row.object_path);
    expect(state.successes).toEqual([row]);
    expect(state.failures).toEqual([]);
  });

  it("records a retry and continues the batch after a transient deletion error", async () => {
    const first = claim(1, 2);
    const second = claim(2, 1);
    const state = store([first, second]);
    const remove = vi.fn(async (_bucket: string, path: string) => {
      if (path === first.object_path) throw new Error("storage unavailable");
    });

    const report = await drainStorageCleanup(state.cleanupStore, remove, 25);

    expect(report).toEqual({ claimed: 2, processed: 1, failed: 1, dead: 0 });
    expect(state.successes).toEqual([second]);
    expect(state.failures).toEqual([
      {
        claim: first,
        outcome: "failed",
        error: "storage unavailable",
        retryInSeconds: 300,
      },
    ]);
  });

  it("marks the fifth failed attempt dead instead of scheduling a sixth", async () => {
    const row = claim(9, CLEANUP_MAX_ATTEMPTS);
    const state = store([row]);

    const report = await drainStorageCleanup(
      state.cleanupStore,
      async () => {
        throw new Error("permission denied");
      },
      25,
    );

    expect(report).toEqual({ claimed: 1, processed: 0, failed: 0, dead: 1 });
    expect(state.failures[0]).toMatchObject({
      outcome: "dead",
      retryInSeconds: null,
      error: "permission denied",
    });
  });

  it("does not mark a row processed when its object removal fails", async () => {
    const state = store([claim(3)]);
    await drainStorageCleanup(
      state.cleanupStore,
      async () => Promise.reject(new Error("remove failed")),
      25,
    );
    expect(state.successes).toEqual([]);
    expect(state.failures).toHaveLength(1);
  });
});
