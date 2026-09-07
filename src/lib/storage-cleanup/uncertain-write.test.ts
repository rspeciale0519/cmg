// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database-app";

vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const support = await import("@/lib/esign/test-support");
const { registerCleanupIntent, removeOrQueueExact } = await import("../storage-cleanup");
const available = await support.localSupabaseAvailable();
if (!available) console.warn("[storage-cleanup] local Supabase unavailable; uncertain-write suite skipped");
const describeDb = available ? describe : describe.skip;

describeDb("uncertain writes against local Postgres and Storage", () => {
  let admin: ReturnType<typeof support.testAdminClient>;
  let claim: Awaited<ReturnType<typeof support.seedClaim>> | undefined;

  beforeAll(async () => {
    admin = support.testAdminClient();
    claim = await support.seedClaim(admin, { status: "under_review", claimants: 1 });
  });

  afterAll(async () => {
    if (claim) await support.cleanupClaim(admin, claim.id, claim.claimRef);
  });

  it("preserves a committed document after response loss and durably queues actual orphans", async () => {
    const claimId = claim!.id;
    const attachedPath = `claims/${claimId}/attached-${crypto.randomUUID()}.pdf`;
    const orphanPath = `claims/${claimId}/orphan-${crypto.randomUUID()}.pdf`;
    const bytes = new TextEncoder().encode("%PDF-1.4\nlocal cleanup regression\n%%EOF");
    for (const objectPath of [attachedPath, orphanPath]) {
      expect(await registerCleanupIntent(admin, "claim-docs", objectPath, claimId)).toBe(true);
      const { error } = await admin.storage.from("claim-docs").upload(objectPath, bytes, {
        contentType: "application/pdf",
        upsert: false,
      });
      expect(error).toBeNull();
    }

    let committedResponseLost = false;
    const uncertainClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: async (input, init) => {
            const response = await fetch(input, init);
            const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
            if (url.pathname === "/rest/v1/documents" && init?.method === "POST" && response.ok) {
              await response.arrayBuffer();
              committedResponseLost = true;
              return new Response(JSON.stringify({ message: "database response lost" }), {
                status: 504,
                headers: { "Content-Type": "application/json" },
              });
            }
            return response;
          },
        },
      },
    );
    const { error: insertError } = await uncertainClient.from("documents").insert({
      claim_id: claimId,
      storage_path: attachedPath,
      original_name: "attached.pdf",
      kind: "other",
      mime: "application/pdf",
      size_bytes: bytes.length,
      visibility: "internal",
    }).select("id");
    expect(committedResponseLost).toBe(true);
    expect(insertError?.message).toBe("database response lost");

    const { data: document, error: documentError } = await admin.from("documents")
      .select("storage_path").eq("claim_id", claimId).single();
    expect(documentError).toBeNull();
    expect(document?.storage_path).toBe(attachedPath);
    const { data: settledIntent, error: intentError } = await admin.from("storage_cleanup_queue")
      .select("processed_at").eq("object_path", attachedPath).single();
    expect(intentError).toBeNull();
    expect(settledIntent?.processed_at).not.toBeNull();

    await removeOrQueueExact(admin, "claim-docs", [attachedPath, orphanPath], claimId);

    const { data: object, error: objectError } = await admin.storage.from("claim-docs").download(attachedPath);
    expect(objectError).toBeNull();
    expect(new Uint8Array(await object!.arrayBuffer())).toEqual(bytes);
    const { data: orphan, error: orphanError } = await admin.storage.from("claim-docs").download(orphanPath);
    expect(orphanError).toBeNull();
    expect(new Uint8Array(await orphan!.arrayBuffer())).toEqual(bytes);

    const { data: queue, error: queueError } = await admin.from("storage_cleanup_queue")
      .select("object_path, attempts, next_attempt_at")
      .eq("claim_id", claimId).is("processed_at", null).is("dead_at", null);
    expect(queueError).toBeNull();
    expect(queue).toHaveLength(2);
    expect(new Set(queue!.map((row) => row.object_path))).toEqual(new Set([attachedPath, orphanPath]));
    expect(queue!.every((row) => row.attempts === 0 && Date.parse(row.next_attempt_at) > Date.now())).toBe(true);
  });
});
