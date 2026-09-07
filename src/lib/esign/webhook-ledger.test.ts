import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { claimWebhookEvent } = await import("./webhook-ledger");
const { WEBHOOK_LEASE_SECONDS } = await import("./webhook-timing");

describe("claimWebhookEvent timing", () => {
  it("passes the long lease to the atomic database claim", async () => {
    const rpc = vi.fn(async () => ({ data: { status: "busy" }, error: null }));

    const outcome = await claimWebhookEvent(
      { rpc } as never,
      "39000000-0000-4000-a000-000000000001",
      "payload-hash",
    );

    expect(outcome).toEqual({ status: "busy" });
    expect(rpc).toHaveBeenCalledWith(
      "claim_pandadoc_webhook_event",
      expect.objectContaining({ p_lease_seconds: WEBHOOK_LEASE_SECONDS }),
    );
  });
});
