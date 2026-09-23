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
    sweepOutbox.mockResolvedValue({
      claimed: 2,
      sent: 2,
      failed: 0,
      dead: 0,
      stale: 0,
    });
  });

  const PUBLIC_FORM = [
    "intake_staff_alert",
    "intake_confirmation",
    "lead_staff_alert",
    "lead_auto_reply",
  ];
  const STAFF_ALERTS = [
    "question_staff_alert",
    "referral_staff_alert",
    "esign_staff_alert",
  ];

  /** The sweep's template preselect, one row per mode. `undefined` is "no
   *  filter", which only platform mode gets. */
  it.each([
    ["simple", PUBLIC_FORM],
    ["", PUBLIC_FORM],
    ["not-a-mode", PUBLIC_FORM],
    ["staff", [...PUBLIC_FORM, ...STAFF_ALERTS]],
    ["platform", undefined],
  ] as const)("SITE_MODE=%j sweeps with the right template filter", async (mode, templates) => {
    process.env.SITE_MODE = mode;

    const response = await GET(new Request("http://localhost/api/cron/outbox"));

    expect(response.status).toBe(200);
    expect(countOutboxOwed).toHaveBeenCalledWith(expect.anything(), templates);
    expect(sweepOutbox).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      12,
      3,
      templates,
    );
  });

  it("reports the stale count so a held-back backlog is visible", async () => {
    process.env.SITE_MODE = "staff";
    sweepOutbox.mockResolvedValue({
      claimed: 3,
      sent: 1,
      failed: 0,
      dead: 2,
      stale: 2,
    });

    const response = await GET(new Request("http://localhost/api/cron/outbox"));

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      dead: 2,
      stale: 2,
    });
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
