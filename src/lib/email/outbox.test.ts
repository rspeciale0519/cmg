import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The contract this pins: **simple mode may only ever dispatch a public form
 * template, and an environment with no Resend key never claims a row.**
 *
 * `dispatchOutbox` is the post-commit optimisation that runs inside the same
 * request as the write that queued a notification. Getting either half wrong is
 * silent: a simple-mode deployment must serve only the public intake and lead
 * forms (spec — simple mode carries no authenticated surface to read a leaked
 * claim-status email from), so a missed template filter would mail platform-only
 * content out of a build that is supposed to have no login at all. And claiming
 * with no key configured would increment `attempts` on rows nobody offered to a
 * provider, walking the whole backlog to `dead` in five sweeps while genuinely
 * believing each attempt failed.
 *
 * `./delivery` is mocked rather than exercised for real: this file's job is the
 * filtering and store wiring around `deliverClaimed`, and `deliverClaimed`
 * itself is covered directly in `./delivery.test.ts`.
 */

const deliverClaimed = vi.fn(async () => ({ claimed: 0, sent: 0, failed: 0, dead: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("./delivery", () => ({
  deliverClaimed,
  OUTBOX_LEASE_SECONDS: 30,
}));

const { dispatchOutbox, sweepOutbox, countOutboxOwed, supabaseOutboxStore } = await import(
  "./outbox"
);

/** A chainable, thenable fake query builder in the shape supabase-js returns. */
function fakeQuery(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return builder;
    },
    in: (...args: unknown[]) => {
      calls.push({ method: "in", args });
      return builder;
    },
    lte: (...args: unknown[]) => {
      calls.push({ method: "lte", args });
      return builder;
    },
    order: (...args: unknown[]) => {
      calls.push({ method: "order", args });
      return builder;
    },
    limit: (...args: unknown[]) => {
      calls.push({ method: "limit", args });
      return builder;
    },
    then: (
      resolve?: ((value: typeof result) => unknown) | null,
      reject?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(resolve ?? undefined, reject ?? undefined),
  };
  return { builder, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.RESEND_API_KEY;
  delete process.env.SITE_MODE;
});

/**
 * The template filter across all three modes, template by template.
 *
 * Written as a matrix because the failure mode is a template nobody classified:
 * a new claim-lifecycle email added later must be refused by default in simple
 * and staff mode, and a staff alert must not silently become deliverable in a
 * marketing build.
 */
const TEMPLATE_MATRIX = [
  // Public forms — the only thing a marketing build sends.
  ["intake_staff_alert", { simple: true, staff: true, platform: true }],
  ["intake_confirmation", { simple: true, staff: true, platform: true }],
  ["lead_staff_alert", { simple: true, staff: true, platform: true }],
  ["lead_auto_reply", { simple: true, staff: true, platform: true }],
  // Staff-inbox alerts — staff mode opens /admin, which is where they link.
  ["question_staff_alert", { simple: false, staff: true, platform: true }],
  ["referral_staff_alert", { simple: false, staff: true, platform: true }],
  ["esign_staff_alert", { simple: false, staff: true, platform: true }],
  // Portal- and invite-linked — the prefix each one points at is closed in
  // staff mode, so delivering it would mail a dead link.
  ["invite", { simple: false, staff: false, platform: true }],
  ["claim_status_update", { simple: false, staff: false, platform: true }],
  ["settled_notice", { simple: false, staff: false, platform: true }],
  ["partner_status_update", { simple: false, staff: false, platform: true }],
  ["reply_posted", { simple: false, staff: false, platform: true }],
  ["lor_signed", { simple: false, staff: false, platform: true }],
] as const;

describe.each(["simple", "staff", "not-a-mode", ""] as const)(
  "dispatchOutbox — template filter with SITE_MODE=%j",
  (mode) => {
    /* An unrecognised mode has to filter like simple, so the matrix is read
       under the simple column for those rows too — fail closed. */
    const column = mode === "staff" ? "staff" : "simple";

    it.each(TEMPLATE_MATRIX)(
      `${mode}: %s`,
      async (template, allowed) => {
        process.env.SITE_MODE = mode;
        process.env.RESEND_API_KEY = "re_test_key";

        const { builder } = fakeQuery({
          data: [{ id: "id-1", template }],
          error: null,
        });
        const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
          typeof dispatchOutbox
        >[0];

        await dispatchOutbox(admin, ["id-1"]);

        if (allowed[column]) {
          expect(deliverClaimed).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(Function),
            expect.objectContaining({ ids: ["id-1"] }),
          );
        } else {
          expect(deliverClaimed).not.toHaveBeenCalled();
        }
      },
    );
  },
);

describe("dispatchOutbox — simple mode template filter", () => {
  it("keeps only public-form templates and hands the filtered ids to delivery", async () => {
    process.env.SITE_MODE = "simple";
    process.env.RESEND_API_KEY = "re_test_key";

    const ids = ["id-1", "id-2", "id-3"];
    const { builder } = fakeQuery({
      data: [
        { id: "id-1", template: "intake_confirmation" },
        { id: "id-2", template: "question_staff_alert" }, // not public
        { id: "id-3", template: "lead_auto_reply" },
      ],
      error: null,
    });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof dispatchOutbox
    >[0];

    await dispatchOutbox(admin, ids);

    expect(admin.from).toHaveBeenCalledWith("notifications_outbox");
    expect(deliverClaimed).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ ids: ["id-1", "id-3"], limit: 2 }),
    );
  });

  it("dispatches nothing further when every id in the batch is non-public", async () => {
    process.env.SITE_MODE = "simple";
    process.env.RESEND_API_KEY = "re_test_key";

    const { builder } = fakeQuery({
      data: [{ id: "id-1", template: "question_staff_alert" }],
      error: null,
    });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof dispatchOutbox
    >[0];

    await dispatchOutbox(admin, ["id-1"]);

    expect(deliverClaimed).not.toHaveBeenCalled();
  });
});

describe("dispatchOutbox — platform mode", () => {
  it("passes every id through untouched, with no template lookup", async () => {
    process.env.SITE_MODE = "platform";
    process.env.RESEND_API_KEY = "re_test_key";

    const admin = { from: vi.fn() } as unknown as Parameters<typeof dispatchOutbox>[0];
    const ids = ["a", "b", "c"];

    await dispatchOutbox(admin, ids);

    expect(admin.from).not.toHaveBeenCalled();
    expect(deliverClaimed).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ ids, limit: 3 }),
    );
  });
});

describe("dispatchOutbox — staff mode keeps a mixed batch apart", () => {
  it("dispatches the staff alert and holds the portal-linked rows back", async () => {
    process.env.SITE_MODE = "staff";
    process.env.RESEND_API_KEY = "re_test_key";

    const { builder } = fakeQuery({
      data: [
        { id: "id-1", template: "esign_staff_alert" },
        { id: "id-2", template: "lor_signed" }, // "a copy is in your portal"
        { id: "id-3", template: "claim_status_update" }, // links into /portal
        { id: "id-4", template: "intake_confirmation" },
      ],
      error: null,
    });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof dispatchOutbox
    >[0];

    await dispatchOutbox(admin, ["id-1", "id-2", "id-3", "id-4"]);

    expect(deliverClaimed).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ ids: ["id-1", "id-4"], limit: 2 }),
    );
  });

  it("still looks the templates up rather than trusting the id list", async () => {
    process.env.SITE_MODE = "staff";
    process.env.RESEND_API_KEY = "re_test_key";

    const { builder } = fakeQuery({ data: [], error: null });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof dispatchOutbox
    >[0];

    await dispatchOutbox(admin, ["id-1"]);

    expect(admin.from).toHaveBeenCalledWith("notifications_outbox");
    expect(deliverClaimed).not.toHaveBeenCalled();
  });
});

describe("dispatchOutbox — no transport configured", () => {
  it("claims nothing when RESEND_API_KEY is blank", async () => {
    process.env.SITE_MODE = "platform";
    process.env.RESEND_API_KEY = "   ";

    const admin = { from: vi.fn() } as unknown as Parameters<typeof dispatchOutbox>[0];

    await dispatchOutbox(admin, ["a"]);

    expect(deliverClaimed).not.toHaveBeenCalled();
  });

  it("claims nothing when RESEND_API_KEY is unset entirely", async () => {
    process.env.SITE_MODE = "platform";
    delete process.env.RESEND_API_KEY;

    const admin = { from: vi.fn() } as unknown as Parameters<typeof dispatchOutbox>[0];

    await dispatchOutbox(admin, ["a"]);

    expect(deliverClaimed).not.toHaveBeenCalled();
  });

  it("returns immediately for an empty id list, before any env check", async () => {
    const admin = { from: vi.fn() } as unknown as Parameters<typeof dispatchOutbox>[0];

    await dispatchOutbox(admin, []);

    expect(admin.from).not.toHaveBeenCalled();
    expect(deliverClaimed).not.toHaveBeenCalled();
  });
});

describe("sweepOutbox — the cron preselect", () => {
  it("filters pending/failed rows by template and due time, then hands the ids through", async () => {
    const { builder, calls } = fakeQuery({
      data: [{ id: "row-1" }, { id: "row-2" }],
      error: null,
    });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof sweepOutbox
    >[0];
    const send = vi.fn();

    await sweepOutbox(admin, send, 12, 3, ["intake_confirmation", "lead_auto_reply"]);

    expect(admin.from).toHaveBeenCalledWith("notifications_outbox");
    const statusCall = calls.find(
      (c) => c.method === "in" && c.args[0] === "status",
    );
    const templateCall = calls.find(
      (c) => c.method === "in" && c.args[0] === "template",
    );
    expect(statusCall?.args[1]).toEqual(["pending", "failed"]);
    expect(templateCall?.args[1]).toEqual(["intake_confirmation", "lead_auto_reply"]);
    expect(calls.some((c) => c.method === "lte")).toBe(true);
    expect(calls.some((c) => c.method === "order")).toBe(true);

    expect(deliverClaimed).toHaveBeenCalledWith(
      expect.anything(),
      send,
      expect.objectContaining({ limit: 12, concurrency: 3, ids: ["row-1", "row-2"] }),
    );
  });

  it("runs with no template filter and no id preselect when none is given", async () => {
    const admin = { from: vi.fn() } as unknown as Parameters<typeof sweepOutbox>[0];
    const send = vi.fn();

    await sweepOutbox(admin, send, 25);

    expect(admin.from).not.toHaveBeenCalled();
    expect(deliverClaimed).toHaveBeenCalledWith(
      expect.anything(),
      send,
      expect.objectContaining({ limit: 25, concurrency: 1, ids: undefined }),
    );
  });

  it("throws rather than sweeping everything when the preselect query fails", async () => {
    const { builder } = fakeQuery({ data: null, error: { message: "timeout" } });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof sweepOutbox
    >[0];

    await expect(
      sweepOutbox(admin, vi.fn(), 10, 1, ["intake_confirmation"]),
    ).rejects.toThrow("timeout");
    expect(deliverClaimed).not.toHaveBeenCalled();
  });
});

describe("supabaseOutboxStore — settle", () => {
  function fakeAdmin(update: (patch: unknown) => Promise<{ error: unknown }>) {
    return {
      from: vi.fn(() => ({
        update: (patch: unknown) => ({
          eq: async () => update(patch),
        }),
      })),
    } as unknown as Parameters<typeof supabaseOutboxStore>[0];
  }

  it("omits next_attempt_at when settling a row sent", async () => {
    const patches: unknown[] = [];
    const admin = fakeAdmin(async (patch) => {
      patches.push(patch);
      return { error: null };
    });

    await supabaseOutboxStore(admin).settle({
      id: "row-1",
      outcome: "sent",
      error: null,
      retryInSeconds: null,
    });

    expect(patches[0]).toMatchObject({ status: "sent", last_error: null });
    expect(patches[0]).toHaveProperty("sent_at");
    expect(patches[0]).not.toHaveProperty("next_attempt_at");
  });

  it("omits next_attempt_at when settling a row dead", async () => {
    const patches: unknown[] = [];
    const admin = fakeAdmin(async (patch) => {
      patches.push(patch);
      return { error: null };
    });

    await supabaseOutboxStore(admin).settle({
      id: "row-1",
      outcome: "dead",
      error: "still failing",
      retryInSeconds: null,
    });

    expect(patches[0]).toMatchObject({ status: "dead", last_error: "still failing" });
    expect(patches[0]).not.toHaveProperty("next_attempt_at");
    expect(patches[0]).not.toHaveProperty("sent_at");
  });

  it("carries next_attempt_at when settling a row failed with a retry", async () => {
    const patches: unknown[] = [];
    const admin = fakeAdmin(async (patch) => {
      patches.push(patch);
      return { error: null };
    });

    await supabaseOutboxStore(admin).settle({
      id: "row-1",
      outcome: "failed",
      error: "451 mailbox unavailable",
      retryInSeconds: 300,
    });

    expect(patches[0]).toMatchObject({ status: "failed", last_error: "451 mailbox unavailable" });
    expect(patches[0]).toHaveProperty("next_attempt_at");
    expect(patches[0]).not.toHaveProperty("sent_at");
  });

  it("throws rather than silently losing a settle the database refused", async () => {
    const admin = fakeAdmin(async () => ({ error: { message: "connection reset" } }));

    await expect(
      supabaseOutboxStore(admin).settle({
        id: "row-1",
        outcome: "sent",
        error: null,
        retryInSeconds: null,
      }),
    ).rejects.toThrow("connection reset");
  });
});

describe("countOutboxOwed", () => {
  it("counts pending and failed rows with no template filter", async () => {
    const { builder, calls } = fakeQuery({ count: 7, error: null });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof countOutboxOwed
    >[0];

    const result = await countOutboxOwed(admin);

    expect(result).toBe(7);
    const statusCall = calls.find((c) => c.method === "in" && c.args[0] === "status");
    expect(statusCall?.args[1]).toEqual(["pending", "failed"]);
    expect(calls.some((c) => c.method === "in" && c.args[0] === "template")).toBe(false);
  });

  it("applies the template list when one is given", async () => {
    const { builder, calls } = fakeQuery({ count: 3, error: null });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof countOutboxOwed
    >[0];

    const result = await countOutboxOwed(admin, ["intake_confirmation", "lead_auto_reply"]);

    expect(result).toBe(3);
    const templateCall = calls.find((c) => c.method === "in" && c.args[0] === "template");
    expect(templateCall?.args[1]).toEqual(["intake_confirmation", "lead_auto_reply"]);
  });

  it("returns null rather than a false zero when the count query fails", async () => {
    const { builder } = fakeQuery({ count: null, error: { message: "timeout" } });
    const admin = { from: vi.fn(() => builder) } as unknown as Parameters<
      typeof countOutboxOwed
    >[0];

    expect(await countOutboxOwed(admin)).toBeNull();
  });
});
