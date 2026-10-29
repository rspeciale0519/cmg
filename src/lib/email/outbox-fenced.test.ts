import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { supabaseOutboxStore } = await import("./outbox");

describe("fenced outbox store", () => {
  it("passes template restrictions to the atomic claim before the batch limit", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const admin = { rpc } as unknown as Parameters<typeof supabaseOutboxStore>[0];
    await supabaseOutboxStore(admin).claim(3, ["id-a"], ["lead_auto_reply"]);
    expect(rpc).toHaveBeenCalledWith("claim_outbox_batch_v2", {
      p_limit: 3, p_lease_seconds: 300, p_ids: ["id-a"], p_templates: ["lead_auto_reply"],
    });
  });

  it("settles a policy hold with the exact claim token", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    const admin = { rpc, from: vi.fn(() => ({ update })) } as unknown as Parameters<typeof supabaseOutboxStore>[0];
    await supabaseOutboxStore(admin).settle({
      id: "id-a", leaseToken: "lease-a", outcome: "held", error: "policy",
      retryInSeconds: null,
    });
    expect(rpc).toHaveBeenCalledWith("settle_outbox_claim_v2", {
      p_id: "id-a", p_token: "lease-a", p_outcome: "held",
      p_error: "policy", p_retry_seconds: null,
    });
  });

  it("reports a stale claim instead of silently treating it as settled", async () => {
    const admin = {
      rpc: vi.fn(async () => ({ data: false, error: null })),
      from: vi.fn(() => ({ update: () => ({ eq: async () => ({ error: null }) }) })),
    } as unknown as Parameters<typeof supabaseOutboxStore>[0];
    await expect(supabaseOutboxStore(admin).settle({
      id: "id-a", leaseToken: "stale-token", outcome: "sent", error: null,
      retryInSeconds: null,
    })).rejects.toThrow();
  });
});
