import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({ check: vi.fn(async () => true) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: stub.check,
  RATE_LIMITS: {
    portalUploadFinalizeUser: { scope: "portal-upload-finalize:user", max: 250, window: "1 hour" },
    portalUploadFinalizeToken: { scope: "portal-upload-finalize:token", max: 30, window: "1 hour" },
    staffUploadPrepareUser: { scope: "staff-upload-prepare:user", max: 20, window: "1 hour" },
    staffUploadFinalizeUser: { scope: "staff-upload-finalize:user", max: 250, window: "1 hour" },
    staffUploadFinalizeToken: { scope: "staff-upload-finalize:token", max: 30, window: "1 hour" },
    portalUploadUser: { scope: "portal-upload:user", max: 20, window: "1 hour" },
  },
}));

const { checkPrivateUploadFinalizeLimit, checkPrivateUploadPrepareLimit } = await import("./rate-limit");

describe("private document finalization limits", () => {
  beforeEach(() => stub.check.mockReset().mockResolvedValue(true));

  it("uses independent user and session-token budgets", async () => {
    expect(await checkPrivateUploadFinalizeLimit("portal", "user-id", "token-hash")).toBe(true);
    expect(stub.check.mock.calls).toEqual([
      [{ scope: "portal-upload-finalize:user", max: 250, window: "1 hour" }, "user-id"],
      [{ scope: "portal-upload-finalize:token", max: 30, window: "1 hour" }, "token-hash"],
    ]);
  });

  it("stops before the token budget when the user budget is exhausted", async () => {
    stub.check.mockResolvedValueOnce(false);
    expect(await checkPrivateUploadFinalizeLimit("portal", "user-id", "token-hash")).toBe(false);
    expect(stub.check).toHaveBeenCalledTimes(1);
  });

  it("bounds staff starts and permits the ordinary ten-file finalize sequence", async () => {
    expect(await checkPrivateUploadPrepareLimit("staff", "staff-id")).toBe(true);
    expect(await checkPrivateUploadFinalizeLimit("staff", "staff-id", "session-hash")).toBe(true);
    expect(stub.check.mock.calls).toEqual([
      [{ scope: "staff-upload-prepare:user", max: 20, window: "1 hour" }, "staff-id"],
      [{ scope: "staff-upload-finalize:user", max: 250, window: "1 hour" }, "staff-id"],
      [{ scope: "staff-upload-finalize:token", max: 30, window: "1 hour" }, "session-hash"],
    ]);
  });
});
