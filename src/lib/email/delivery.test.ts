import { describe, expect, it, vi } from "vitest";
import {
  deliverClaimed,
  outcomeAfterFailure,
  OUTBOX_BACKOFF_SECONDS,
  OUTBOX_MAX_ATTEMPTS,
  type ClaimedRow,
  type OutboxStore,
  type SettleInput,
} from "./delivery";

function row(overrides: Partial<ClaimedRow> = {}): ClaimedRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    recipient_email: "dana@example.test",
    template: "lead_auto_reply",
    payload: { firstName: "Dana" },
    attempts: 1,
    ...overrides,
  };
}

/**
 * A store that hands each row out exactly once, however many times it is asked.
 * This is the whole concurrency guard in miniature: `claim_outbox_batch` gives
 * the same guarantee with `for update skip locked` and a lease, and a fake that
 * behaves the same way lets the engine's half of the contract be tested without
 * a database.
 */
function singleClaimStore(rows: ClaimedRow[]) {
  const settled: SettleInput[] = [];
  let remaining = [...rows];

  const store: OutboxStore = {
    async claim(limit) {
      const taken = remaining.slice(0, limit);
      remaining = remaining.slice(limit);
      return taken;
    },
    async settle(result) {
      settled.push(result);
    },
  };

  return { store, settled };
}

describe("outcomeAfterFailure — the backoff schedule", () => {
  it("waits 1 minute, then 5, then 25, then about 2 hours", () => {
    expect(outcomeAfterFailure(1)).toEqual({ outcome: "failed", retryInSeconds: 60 });
    expect(outcomeAfterFailure(2)).toEqual({ outcome: "failed", retryInSeconds: 300 });
    expect(outcomeAfterFailure(3)).toEqual({ outcome: "failed", retryInSeconds: 1500 });
    expect(outcomeAfterFailure(4)).toEqual({ outcome: "failed", retryInSeconds: 7500 });
  });

  it("is exponential with a factor of five", () => {
    for (let i = 1; i < OUTBOX_BACKOFF_SECONDS.length; i += 1) {
      expect(OUTBOX_BACKOFF_SECONDS[i]).toBe(OUTBOX_BACKOFF_SECONDS[i - 1] * 5);
    }
  });

  /* The table has one entry fewer than the attempt limit, on purpose: the fifth
     failure has no sixth attempt to schedule. If the two ever drift, an
     out-of-range read would put `undefined` into a timestamp. */
  it("holds exactly one fewer delay than the attempt limit", () => {
    expect(OUTBOX_BACKOFF_SECONDS).toHaveLength(OUTBOX_MAX_ATTEMPTS - 1);
  });
});

describe("outcomeAfterFailure — the dead-letter rule", () => {
  it("declares the row dead on the fifth attempt and schedules no retry", () => {
    expect(outcomeAfterFailure(5)).toEqual({ outcome: "dead", retryInSeconds: null });
  });

  it("stays dead beyond five, rather than wrapping back onto the schedule", () => {
    expect(outcomeAfterFailure(6).outcome).toBe("dead");
    expect(outcomeAfterFailure(99).outcome).toBe("dead");
  });

  it("keeps the first four attempts alive", () => {
    for (let attempts = 1; attempts <= OUTBOX_MAX_ATTEMPTS - 1; attempts += 1) {
      expect(outcomeAfterFailure(attempts).outcome).toBe("failed");
    }
  });

  /* `attempts` arrives from the database, and a zero would mean the claim did
     not increment. Clamped rather than trusted: reading slot -1 is `undefined`. */
  it("treats a nonsensical attempt count as the first attempt", () => {
    expect(outcomeAfterFailure(0).retryInSeconds).toBe(60);
  });
});

describe("deliverClaimed", () => {
  it("marks a delivered row sent, with no error and no retry", async () => {
    const { store, settled } = singleClaimStore([row()]);
    const send = vi.fn(async () => {});

    const report = await deliverClaimed(store, send, { limit: 10 });

    expect(report).toEqual({ claimed: 1, sent: 1, failed: 0, dead: 0 });
    expect(settled).toEqual([
      {
        id: row().id,
        outcome: "sent",
        error: null,
        retryInSeconds: null,
      },
    ]);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: row().id,
        to: "dana@example.test",
      }),
    );
  });

  it("rejects an unsettled successful send without recording a false provider failure", async () => {
    const settle = vi.fn(async (result: SettleInput) => {
      if (result.outcome === "sent") throw new Error("database unavailable");
    });
    const store: OutboxStore = {
      claim: async () => [row()],
      settle,
    };
    const send = vi.fn(async () => {});

    await expect(deliverClaimed(store, send, { limit: 1 })).rejects.toThrow(
      "database unavailable",
    );

    expect(send).toHaveBeenCalledOnce();
    expect(settle).toHaveBeenCalledOnce();
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({ outcome: "sent" }));
  });

  it("times out a stuck provider call and leaves the row retryable", async () => {
    vi.useFakeTimers();
    try {
      const { store, settled } = singleClaimStore([row()]);
      const send = vi.fn(() => new Promise<void>(() => {}));

      const delivery = deliverClaimed(store, send, { limit: 1 });
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(delivery).resolves.toEqual({
        claimed: 1,
        sent: 0,
        failed: 1,
        dead: 0,
      });
      expect(settled[0]).toMatchObject({
        outcome: "failed",
        error: "provider send timed out",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("never exceeds the requested worker-pool concurrency", async () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row({ id: `1000000${index}-1111-4111-8111-111111111111` }),
    );
    const { store } = singleClaimStore(rows);
    let active = 0;
    let peak = 0;
    const send = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
    });

    const report = await deliverClaimed(store, send, { limit: 12, concurrency: 3 });

    expect(report.sent).toBe(12);
    expect(peak).toBe(3);
  });

  it("records the provider's message and the next delay when a send fails", async () => {
    const { store, settled } = singleClaimStore([row({ attempts: 2 })]);
    const send = vi.fn(async () => {
      throw new Error("451 mailbox unavailable");
    });

    const report = await deliverClaimed(store, send, { limit: 10 });

    expect(report).toEqual({ claimed: 1, sent: 0, failed: 1, dead: 0 });
    expect(settled[0]).toMatchObject({
      outcome: "failed",
      error: "451 mailbox unavailable",
      retryInSeconds: 300,
    });
  });

  it("dead-letters the fifth failure", async () => {
    const { store, settled } = singleClaimStore([row({ attempts: 5 })]);
    const send = vi.fn(async () => {
      throw new Error("still failing");
    });

    const report = await deliverClaimed(store, send, { limit: 10 });

    expect(report).toEqual({ claimed: 1, sent: 0, failed: 0, dead: 1 });
    expect(settled[0]).toMatchObject({ outcome: "dead", retryInSeconds: null });
  });

  /* A payload the renderer cannot handle is a permanent failure, and it has to
     be spent through the same five attempts as any other — otherwise it is
     reclaimed for ever. The render is inside the try for exactly this. */
  it("counts an unrenderable payload as a failure rather than throwing", async () => {
    const { store, settled } = singleClaimStore([
      row({ template: "no_such_template", attempts: 5 }),
    ]);
    const send = vi.fn(async () => {});

    const report = await deliverClaimed(store, send, { limit: 10 });

    expect(send).not.toHaveBeenCalled();
    expect(report.dead).toBe(1);
    expect(settled[0]).toMatchObject({ outcome: "dead" });
  });

  it("truncates a provider error that arrives as a wall of HTML", async () => {
    const { store, settled } = singleClaimStore([row()]);
    const send = vi.fn(async () => {
      throw new Error("x".repeat(4000));
    });

    await deliverClaimed(store, send, { limit: 10 });

    expect(settled[0].error).toHaveLength(500);
  });

  it("keeps going after one row fails, so a bad row cannot block the batch", async () => {
    const { store, settled } = singleClaimStore([
      row({ id: "aaaaaaaa-1111-4111-8111-111111111111" }),
      row({ id: "bbbbbbbb-1111-4111-8111-111111111111" }),
      row({ id: "cccccccc-1111-4111-8111-111111111111" }),
    ]);
    const send = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce(undefined);

    const report = await deliverClaimed(store, send, { limit: 10 });

    expect(report).toEqual({ claimed: 3, sent: 2, failed: 1, dead: 0 });
    expect(settled).toHaveLength(3);
  });
});

describe("deliverClaimed — two sweepers cannot send the same notification twice", () => {
  it("sends each claimed row exactly once across concurrent sweeps", async () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      row({ id: `0000000${index}-1111-4111-8111-111111111111` }),
    );
    const { store } = singleClaimStore(rows);

    const sent: string[] = [];
    const send = vi.fn(async (message: { to: string; subject: string }) => {
      sent.push(message.subject);
    });

    /* Both sweepers run against one store, exactly as two cron invocations run
       against one table. The store hands a row to whichever asks first and never
       hands it out again — which is what `for update skip locked` does — so the
       union of what they send must be the six rows, with nothing repeated. */
    const [first, second] = await Promise.all([
      deliverClaimed(store, send, { limit: 4 }),
      deliverClaimed(store, send, { limit: 4 }),
    ]);

    expect(first.claimed + second.claimed).toBe(6);
    expect(send).toHaveBeenCalledTimes(6);
    expect(sent).toHaveLength(6);
  });

  it("sends nothing at all when the claim comes back empty", async () => {
    const { store } = singleClaimStore([]);
    const send = vi.fn(async () => {});

    const report = await deliverClaimed(store, send, { limit: 25 });

    expect(report).toEqual({ claimed: 0, sent: 0, failed: 0, dead: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});
