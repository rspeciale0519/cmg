import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const authorizeCronRequest = vi.fn();
const createAdminClient = vi.fn();
const sweepStorageCleanup = vi.fn();

vi.mock("@/lib/cron/auth", () => ({ authorizeCronRequest }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/storage-cleanup/queue", () => ({ sweepStorageCleanup }));

const { GET } = await import("./route");

describe("storage cleanup cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses before constructing a service-role client or touching the queue", async () => {
    authorizeCronRequest.mockReturnValue({
      ok: false,
      status: 401,
      reason: "wrong secret",
    });

    const response = await GET(new Request("http://localhost/api/cron/storage-cleanup"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "wrong secret",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(sweepStorageCleanup).not.toHaveBeenCalled();
  });

  it("uses the bounded worker only after authorization succeeds", async () => {
    const admin = { service: "admin" };
    authorizeCronRequest.mockReturnValue({ ok: true });
    createAdminClient.mockReturnValue(admin);
    sweepStorageCleanup.mockResolvedValue({
      claimed: 1,
      processed: 1,
      failed: 0,
      dead: 0,
    });

    const response = await GET(new Request("http://localhost/api/cron/storage-cleanup"));

    expect(createAdminClient).toHaveBeenCalledOnce();
    expect(sweepStorageCleanup).toHaveBeenCalledExactlyOnceWith(admin, 25);
    expect(createAdminClient.mock.invocationCallOrder[0]).toBeLessThan(
      sweepStorageCleanup.mock.invocationCallOrder[0],
    );
    await expect(response.json()).resolves.toMatchObject({ ok: true, processed: 1 });
  });
});
