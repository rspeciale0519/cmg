// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const support = await import("@/lib/esign/test-support");
const { supabaseCleanupStore } = await import("./queue");
type TestAdmin = ReturnType<typeof support.testAdminClient>;

const available = await support.localSupabaseAvailable();
if (!available) {
  console.warn(
    "[storage-cleanup] local Supabase is not reachable — concurrency suite skipped",
  );
}
const describeDb = available ? describe : describe.skip;

describeDb("storage cleanup claims against the local database", () => {
  let first: TestAdmin;
  let second: TestAdmin;
  let ids: number[] = [];
  const marker = `claims/cleanup-concurrency/${crypto.randomUUID()}`;

  beforeAll(async () => {
    first = support.testAdminClient();
    second = support.testAdminClient();

    const rows = Array.from({ length: 12 }, (_, index) => ({
      bucket_id: "claim-docs",
      object_path: `${marker}/${index}.pdf`,
      next_attempt_at: new Date(Date.now() - 60_000).toISOString(),
    }));
    const { data, error } = await first
      .from("storage_cleanup_queue")
      .insert(rows)
      .select("id");
    if (error) throw new Error(error.message);
    ids = (data ?? []).map((row) => row.id);
  });

  afterAll(async () => {
    await first.from("documents").delete().like("storage_path", `${marker}/%`);
    await first.from("storage_cleanup_queue").delete().like("object_path", `${marker}/%`);
  });

  async function insertDue(label: string): Promise<number> {
    const { data, error } = await first
      .from("storage_cleanup_queue")
      .insert({
        bucket_id: "claim-docs",
        object_path: `${marker}/${label}.pdf`,
        next_attempt_at: new Date(Date.now() - 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    ids.push(data.id);
    return data.id;
  }

  it("partitions due rows between truly concurrent independent clients", async () => {
    const [left, right] = await Promise.all([
      first.rpc("claim_storage_cleanup_batch", {
        p_limit: 12,
        p_lease_seconds: 300,
        p_max_attempts: 5,
      }),
      second.rpc("claim_storage_cleanup_batch", {
        p_limit: 12,
        p_lease_seconds: 300,
        p_max_attempts: 5,
      }),
    ]);

    if (left.error) throw new Error(left.error.message);
    if (right.error) throw new Error(right.error.message);

    const expected = new Set(ids);
    const leftIds = (left.data ?? []).map((row) => row.id).filter((id) => expected.has(id));
    const rightIds = (right.data ?? []).map((row) => row.id).filter((id) => expected.has(id));
    const claimed = [...leftIds, ...rightIds];

    expect(new Set(claimed).size).toBe(claimed.length);
    expect(new Set(claimed)).toEqual(expected);
  });

  it("serializes a worker claim against document settlement", async () => {
    const path = `${marker}/claim-vs-document.pdf`;
    const { data: enqueued, error: enqueueError } = await first
      .from("storage_cleanup_queue")
      .insert({
        bucket_id: "claim-docs",
        object_path: path,
        claim_id: "20000000-0000-4000-a000-000000000001",
        next_attempt_at: new Date(Date.now() - 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (enqueueError) throw new Error(enqueueError.message);
    ids.push(enqueued.id);

    const [claim, document] = await Promise.all([
      first.rpc("claim_storage_cleanup_batch", {
        p_limit: 1,
        p_lease_seconds: 300,
        p_max_attempts: 5,
      }),
      second
        .from("documents")
        .insert({
          claim_id: "20000000-0000-4000-a000-000000000001",
          storage_path: path,
          original_name: "claim-vs-document.pdf",
          kind: "other",
          mime: "application/pdf",
          size_bytes: 1,
          visibility: "internal",
        })
        .select("id")
        .maybeSingle(),
    ]);
    if (claim.error) throw new Error(claim.error.message);

    const claimed = (claim.data ?? []).some((row) => row.id === enqueued.id);
    const committed = document.error === null && document.data !== null;
    expect([claimed, committed].filter(Boolean)).toHaveLength(1);

    const { data: queue } = await first
      .from("storage_cleanup_queue")
      .select("attempts, processed_at")
      .eq("id", enqueued.id)
      .single();
    expect(queue).not.toBeNull();
    if (claimed) {
      expect(document.error?.message).toBe("storage cleanup already claimed");
      expect(queue?.attempts).toBe(1);
    } else {
      expect(queue?.attempts).toBe(0);
      expect(queue?.processed_at).not.toBeNull();
    }
  });

  it("rejects a stale success settlement after the attempt token changes", async () => {
    const id = await insertDue("stale-success");
    const store = supabaseCleanupStore(first);
    const [claimed] = await store.claim(1);
    expect(claimed.id).toBe(id);

    const { error } = await first
      .from("storage_cleanup_queue")
      .update({ attempts: claimed.attempts + 1 })
      .eq("id", id);
    if (error) throw new Error(error.message);

    await expect(store.settleSuccess(claimed)).rejects.toThrow(
      `Storage cleanup lease for queue row ${id} is no longer current.`,
    );

    const { data } = await first
      .from("storage_cleanup_queue")
      .select("processed_at")
      .eq("id", id)
      .single();
    expect(data?.processed_at).toBeNull();
  });

  it("rejects a stale failure settlement after the attempt token changes", async () => {
    const id = await insertDue("stale-failure");
    const store = supabaseCleanupStore(first);
    const [claimed] = await store.claim(1);
    expect(claimed.id).toBe(id);

    const { error } = await first
      .from("storage_cleanup_queue")
      .update({ attempts: claimed.attempts + 1 })
      .eq("id", id);
    if (error) throw new Error(error.message);

    await expect(
      store.settleFailure({
        claim: claimed,
        outcome: "failed",
        error: "stale worker error",
        retryInSeconds: 60,
      }),
    ).rejects.toThrow(
      `Storage cleanup lease for queue row ${id} is no longer current.`,
    );

    const { data } = await first
      .from("storage_cleanup_queue")
      .select("last_error")
      .eq("id", id)
      .single();
    expect(data?.last_error).toBeNull();
  });
});
