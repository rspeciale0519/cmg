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

describe("PandaDoc webhook in simple mode", () => {
  beforeEach(() => {
    process.env.SITE_MODE = "simple";
    processPandaDocWebhook.mockReset();
  });

  it("returns not found before reading or processing the provider request", async () => {
    const response = await POST(
      new Request("http://localhost/api/pandadoc/webhook?signature=secret", {
        method: "POST",
        body: "should not be read",
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      reason: "platform_disabled",
    });
    expect(processPandaDocWebhook).not.toHaveBeenCalled();
  });
});
