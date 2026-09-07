// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeCronRequest = vi.fn();
const createAdminClient = vi.fn();
const countOutboxOwed = vi.fn();
const resendSender = vi.fn();
const sweepOutbox = vi.fn();

vi.mock("@/lib/cron/auth", () => ({ authorizeCronRequest }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/email/outbox", () => ({
  countOutboxOwed,
  resendSender,
  sweepOutbox,
}));

const { GET } = await import("./route");

describe("outbox cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SITE_MODE = "simple";
    authorizeCronRequest.mockReturnValue({ ok: true });
    createAdminClient.mockReturnValue({});
    countOutboxOwed.mockResolvedValue(2);
    resendSender.mockResolvedValue(vi.fn());
    sweepOutbox.mockResolvedValue({ claimed: 2, sent: 2, failed: 0, dead: 0 });
  });

  it("limits simple-mode delivery to public form templates", async () => {
    const response = await GET(new Request("http://localhost/api/cron/outbox"));

    expect(response.status).toBe(200);
    expect(countOutboxOwed).toHaveBeenCalledWith(
      expect.anything(),
      [
        "intake_staff_alert",
        "intake_confirmation",
        "lead_staff_alert",
        "lead_auto_reply",
      ],
    );
    expect(sweepOutbox).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      12,
      3,
      [
        "intake_staff_alert",
        "intake_confirmation",
        "lead_staff_alert",
        "lead_auto_reply",
      ],
    );
  });

  it("refuses before creating the admin client", async () => {
    authorizeCronRequest.mockReturnValue({
      ok: false,
      status: 401,
      reason: "wrong secret",
    });

    const response = await GET(new Request("http://localhost/api/cron/outbox"));

    expect(response.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(countOutboxOwed).not.toHaveBeenCalled();
  });
});
