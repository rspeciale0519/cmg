// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const processPandaDocWebhook = vi.fn();

vi.mock("@/lib/esign/webhook", () => ({
  processPandaDocWebhook,
  WEBHOOK_EVENT_ID_HEADER: "X-PandaDoc-Webhook-Event-Id",
  WEBHOOK_SIGNATURE_PARAM: "signature",
}));

const { POST } = await import("./route");

function post(): Promise<Response> {
  return POST(
    new Request("http://localhost/api/pandadoc/webhook?signature=secret", {
      method: "POST",
      body: '{"event":"recipient_completed"}',
    }),
  );
}

beforeEach(() => {
  processPandaDocWebhook.mockReset();
  processPandaDocWebhook.mockResolvedValue({ status: 200, body: { ok: true } });
});

/**
 * The route's mode question is "is the staff claims desk open", not "is this
 * platform mode". Every one of these cells is that decision:
 *
 *   * `simple` — no claims desk, nothing sends an LOR, so a callback can only
 *     be noise or a probe. 404, before the body is read.
 *   * `staff` — the desk is open and staff can send an LOR, so the signed
 *     callback that records the outcome must land. Closing it would let staff
 *     send documents that a homeowner signs and the database never learns about.
 *   * `platform` — unchanged.
 *   * anything unrecognised — simple, fail closed.
 */
describe.each([
  ["simple", false],
  ["", false],
  ["not-a-mode", false],
  ["staff", true],
  ["platform", true],
] as const)("PandaDoc webhook with SITE_MODE=%j", (mode, reachable) => {
  beforeEach(() => {
    process.env.SITE_MODE = mode;
  });

  if (reachable) {
    it("processes the delivery, leaving HMAC verification to do the refusing", async () => {
      const response = await post();

      expect(response.status).toBe(200);
      expect(processPandaDocWebhook).toHaveBeenCalledOnce();
      /* The signature is handed on rather than trusted here: the route's job is
         to read the raw bytes and delegate, and `processPandaDocWebhook` owns
         verify → dedupe → process. */
      expect(processPandaDocWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ signature: "secret" }),
      );
    });
  } else {
    it("returns not found before reading or processing the provider request", async () => {
      const response = await post();

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        reason: "platform_disabled",
      });
      expect(processPandaDocWebhook).not.toHaveBeenCalled();
    });
  }
});
