// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  sendLor: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/esign", () => ({ sendLor: (...args: unknown[]) => mocks.sendLor(...args) }));

const { submitLorRecovery } = await import("./esign");

const CLAIM_ID = "11111111-2222-4333-8444-555555555555";
const REQUEST_ID = "99999999-8888-4777-8666-555555555555";

function form(intent: string, overrides: Record<string, string> = {}) {
  const data = new FormData();
  data.set("claimId", overrides.claimId ?? CLAIM_ID);
  data.set("requestId", overrides.requestId ?? REQUEST_ID);
  data.set("intent", intent);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sendLor.mockResolvedValue({
    ok: true,
    deliveredByProvider: true,
    recipients: ["dana@example.com"],
  });
});
describe("submitLorRecovery", () => {
  it("uses the configured provider for electronic retry and preserves request id", async () => {
    const state = await submitLorRecovery({ status: "idle" }, form("electronic"));
    expect(state.status).toBe("success");
    expect(mocks.sendLor).toHaveBeenCalledWith(
      { claimId: CLAIM_ID, requestId: REQUEST_ID },
      undefined,
    );
  });

  it("uses only the fixed ManualSignProvider for manual fallback", async () => {
    mocks.sendLor.mockResolvedValue({
      ok: true,
      deliveredByProvider: false,
      recipients: ["dana@example.com"],
    });
    const state = await submitLorRecovery({ status: "idle" }, form("manual"));
    const deps = mocks.sendLor.mock.calls[0][1];
    expect(deps.provider.kind).toBe("manual");
    expect(state.message).toMatch(/upload the signed copy/i);
  });

  it("passes authorization refusal through and never revalidates", async () => {
    mocks.sendLor.mockResolvedValue({
      ok: false,
      code: "not_authorized",
      message: "That claim is not available to send a Letter of Representation on.",
    });
    const state = await submitLorRecovery({ status: "idle" }, form("manual"));
    expect(state).toMatchObject({ status: "error", message: expect.stringMatching(/not available/) });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["provider_error", "The signing request could not be completed. Check the request status before you try again."],
    ["not_configured", "Electronic signing is not configured. Contact the site administrator before you try again."],
  ])("does not return provider details for %s", async (code, message) => {
    const vendorDetail = "private-recipient@example.test fake-provider-key-do-not-expose";
    mocks.sendLor.mockResolvedValue({ ok: false, code, message: vendorDetail });

    const state = await submitLorRecovery({ status: "idle" }, form("electronic"));

    expect(state).toEqual({ status: "error", message });
    expect(JSON.stringify(state)).not.toContain(vendorDetail);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("preserves the operator warning when an uncertain send remains locked", async () => {
    const message =
      "PandaDoc may have accepted this letter. Automatic retry is locked to prevent a duplicate. Check the request in PandaDoc before manual recovery.";
    mocks.sendLor.mockResolvedValue({ ok: false, code: "request_in_progress", message });

    const state = await submitLorRecovery({ status: "idle" }, form("electronic"));

    expect(state).toEqual({ status: "error", message });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["arbitrary-provider", {}],
    ["manual", { claimId: "not-a-uuid" }],
    ["manual", { requestId: "not-a-uuid" }],
  ])("refuses malformed submission %s before sendLor", async (intent, overrides) => {
    const state = await submitLorRecovery({ status: "idle" }, form(intent, overrides));
    expect(state.status).toBe("error");
    expect(mocks.sendLor).not.toHaveBeenCalled();
  });
});
