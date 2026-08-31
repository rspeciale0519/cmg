// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  writeAudit: vi.fn(),
  settleDispatch: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ writeAudit: mocks.writeAudit }));
vi.mock("./dispatch-ledger", () => ({ settleDispatch: mocks.settleDispatch }));

const { handleDispatchFailure } = await import("./lor-dispatch-failure");
const { ESignError } = await import("./types");

const SECRET = "fake-provider-key-do-not-expose";
const RECIPIENT = "private-recipient@example.test";
const VENDOR_DETAIL = `Request failed for ${RECIPIENT}; Authorization: API-Key ${SECRET}`;
const PROVIDER_MESSAGE =
  "The signing request could not be completed. Check the request status before you try again.";
const NOT_CONFIGURED_MESSAGE =
  "Electronic signing is not configured. Contact the site administrator before you try again.";
const input = {
  claimId: "11111111-2222-4333-8444-555555555555",
  actorId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  mode: "pandadoc" as const,
  requestId: "99999999-8888-4777-8666-555555555555",
  claimToken: "22222222-3333-4444-8555-666666666666",
};

function adminClient(persistError: { message: string } | null = null) {
  const tokenFilter = vi.fn().mockResolvedValue({ error: persistError });
  const claimFilter = vi.fn().mockReturnValue({ eq: tokenFilter });
  const update = vi.fn().mockReturnValue({ eq: claimFilter });
  const admin = { from: vi.fn().mockReturnValue({ update }) };
  return {
    admin: admin as unknown as Parameters<typeof handleDispatchFailure>[0],
    update,
    claimFilter,
    tokenFilter,
  };
}

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.writeAudit.mockResolvedValue(undefined);
  mocks.settleDispatch.mockResolvedValue(true);
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function expectNoVendorData(result: unknown) {
  const captured = JSON.stringify({
    result,
    logs: logged.mock.calls,
    audit: mocks.writeAudit.mock.calls,
    ledger: mocks.settleDispatch.mock.calls,
  });
  expect(captured).not.toContain(SECRET);
  expect(captured).not.toContain(RECIPIENT);
}

describe("LOR dispatch failure privacy", () => {
  it("returns a generic failure and saves only safe diagnostics for a rejected request", async () => {
    const store = adminClient();
    const result = await handleDispatchFailure(store.admin, {
      ...input,
      error: new ESignError("creation_failed", VENDOR_DETAIL, 400),
    });

    expect(result).toEqual({ ok: false, code: "provider_error", message: PROVIDER_MESSAGE });
    expectNoVendorData(result);
    expect(store.update).toHaveBeenCalledWith({ esign_status: "document.creation_failed" });
    expect(store.claimFilter).toHaveBeenCalledWith("id", input.claimId);
    expect(store.tokenFilter).toHaveBeenCalledWith("esign_dispatch_token", input.claimToken);
    expect(mocks.writeAudit).toHaveBeenCalledWith(store.admin, expect.objectContaining({
      action: "esign.lor_send_failed",
      meta: expect.objectContaining({ provider_code: "creation_failed", http_status: 400 }),
    }));
    expect(mocks.settleDispatch).toHaveBeenCalledWith(
      store.admin, input.requestId, input.claimToken, "failed", result,
    );
  });

  it("keeps an uncertain send locked without saving its vendor detail", async () => {
    const store = adminClient();
    const result = await handleDispatchFailure(store.admin, {
      ...input,
      error: new ESignError("send_failed", VENDOR_DETAIL, 503, true),
    });

    expect(result).toMatchObject({ ok: false, code: "request_in_progress" });
    expect(result.message).toMatch(/may have accepted/i);
    expect(result.message).toMatch(/automatic retry is locked/i);
    expect(result.message).toMatch(/PandaDoc before.*manual recovery/i);
    expectNoVendorData(result);
    expect(store.update).toHaveBeenCalledWith({ esign_status: "document.send_uncertain" });
    expect(mocks.settleDispatch).not.toHaveBeenCalled();
    expect(mocks.writeAudit).toHaveBeenCalledWith(store.admin, expect.objectContaining({
      action: "esign.lor_send_uncertain",
      meta: expect.objectContaining({
        provider_code: "send_failed", http_status: 503, request_id: input.requestId,
      }),
    }));
  });

  it("keeps configuration failures distinct without returning environment details", async () => {
    const { admin } = adminClient();
    const result = await handleDispatchFailure(admin, {
      ...input,
      error: new ESignError("not_configured", VENDOR_DETAIL),
    });

    expect(result).toEqual({ ok: false, code: "not_configured", message: NOT_CONFIGURED_MESSAGE });
    expectNoVendorData(result);
  });

  it.each([
    new TypeError(VENDOR_DETAIL),
    VENDOR_DETAIL,
    { message: VENDOR_DETAIL, code: SECRET },
    null,
  ])("does not serialize an unexpected provider error (%#)", async (error) => {
    const { admin } = adminClient();
    const result = await handleDispatchFailure(admin, { ...input, error });

    expect(result).toEqual({ ok: false, code: "provider_error", message: PROVIDER_MESSAGE });
    expectNoVendorData(result);
    expect(mocks.writeAudit).toHaveBeenCalledWith(admin, expect.objectContaining({
      meta: expect.objectContaining({ provider_code: "unexpected_error", http_status: null }),
    }));
  });

  it("rejects unexpected diagnostic values instead of logging them", async () => {
    const { admin } = adminClient();
    const error = new ESignError("send_failed", VENDOR_DETAIL);
    Object.assign(error, { code: SECRET, httpStatus: RECIPIENT });

    const result = await handleDispatchFailure(admin, { ...input, error });

    expectNoVendorData(result);
    expect(mocks.writeAudit).toHaveBeenCalledWith(admin, expect.objectContaining({
      meta: expect.objectContaining({ provider_code: "unexpected_error", http_status: null }),
    }));
  });

  it("does not log a database error while recording the failure state", async () => {
    const { admin } = adminClient({ message: VENDOR_DETAIL });
    const result = await handleDispatchFailure(admin, {
      ...input,
      error: new ESignError("creation_failed", VENDOR_DETAIL, 400),
    });

    expectNoVendorData(result);
    expect(logged).toHaveBeenCalledWith(
      "[esign] sendLor failure state persist failed",
      { claimId: input.claimId, code: "failure_state_persist_failed" },
    );
  });
});
