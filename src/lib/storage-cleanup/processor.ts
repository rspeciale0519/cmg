export const CLEANUP_BACKOFF_SECONDS: readonly number[] = [60, 300, 1500, 7500];
export const CLEANUP_MAX_ATTEMPTS = 5;
export const CLEANUP_LEASE_SECONDS = 300;

export type CleanupClaim = {
  id: number;
  bucket_id: string;
  object_path: string;
  attempts: number;
};

export type CleanupOutcome = "failed" | "dead";

export type CleanupFailure = {
  claim: CleanupClaim;
  outcome: CleanupOutcome;
  error: string;
  retryInSeconds: number | null;
};

export type CleanupStore = {
  claim: (limit: number) => Promise<CleanupClaim[]>;
  settleSuccess: (claim: CleanupClaim) => Promise<void>;
  settleFailure: (failure: CleanupFailure) => Promise<void>;
};

export type RemoveObject = (bucketId: string, objectPath: string) => Promise<void>;

export type CleanupReport = {
  claimed: number;
  processed: number;
  failed: number;
  dead: number;
};

export function cleanupOutcomeAfterFailure(attempts: number): {
  outcome: CleanupOutcome;
  retryInSeconds: number | null;
} {
  if (attempts >= CLEANUP_MAX_ATTEMPTS) {
    return { outcome: "dead", retryInSeconds: null };
  }

  const index = Math.min(
    Math.max(attempts, 1) - 1,
    CLEANUP_BACKOFF_SECONDS.length - 1,
  );
  return { outcome: "failed", retryInSeconds: CLEANUP_BACKOFF_SECONDS[index] };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message.slice(0, 500)
    : "unknown storage cleanup error";
}

export async function drainStorageCleanup(
  store: CleanupStore,
  removeObject: RemoveObject,
  limit: number,
): Promise<CleanupReport> {
  const claims = await store.claim(limit);
  const report: CleanupReport = {
    claimed: claims.length,
    processed: 0,
    failed: 0,
    dead: 0,
  };

  for (const claim of claims) {
    try {
      await removeObject(claim.bucket_id, claim.object_path);
      await store.settleSuccess(claim);
      report.processed += 1;
    } catch (cause) {
      const { outcome, retryInSeconds } = cleanupOutcomeAfterFailure(
        claim.attempts,
      );
      await store.settleFailure({
        claim,
        outcome,
        error: errorMessage(cause),
        retryInSeconds,
      });
      report[outcome] += 1;
    }
  }

  return report;
}
