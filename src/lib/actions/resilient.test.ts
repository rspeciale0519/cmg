import { describe, expect, it, vi } from "vitest";
import {
  CONNECTION_LOST,
  idleState,
  resilient,
  type FormState,
} from "./types";

/**
 * The contract these pin: **a transport failure is a refusal, not an exception,
 * and it hands the submission back.**
 *
 * `useActionState` does not catch. A rejected action promise is re-thrown during
 * render and reaches the nearest error boundary, which on a claim's Overview
 * replaced the note an adjuster had written for the homeowner, the status
 * radios and the whole tab strip — under a screen that said "no work has been
 * lost". Thirty-one call sites go through this wrapper, and nothing else in the
 * suite would notice one of them losing its guard.
 *
 * The two behaviours that must not regress are the echo and the passthrough of
 * Next's control-flow throws: `redirect()` and `notFound()` signal by throwing,
 * and a wrapper that swallowed them would turn a hand-off into a silent no-op.
 */

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const NOTE = "Carrier called back — adjuster booked for Tuesday.";

describe("resilient", () => {
  it("turns a rejected action into an error state rather than throwing", async () => {
    const action = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const state = await resilient(action as never)(idleState, form({}));

    expect(state.status).toBe("error");
    expect(state.message).toBe(CONNECTION_LOST);
  });

  it("hands back every string field that was submitted", async () => {
    const action = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const state = (await resilient(action as never)(
      idleState,
      form({ claimId: "abc", to: "denied", note: NOTE }),
    )) as FormState;

    expect(state.values).toEqual({ claimId: "abc", to: "denied", note: NOTE });
  });

  it("says the write may already have landed rather than that it did not", async () => {
    const action = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const state = await resilient(action as never)(idleState, form({}));

    // The client cannot tell "never left" from "committed, answer lost". The
    // message has to leave that open; the old error screen closed it wrongly.
    expect(state.message).toMatch(/may already have been recorded/);
    expect(state.message).not.toMatch(/nothing (was|has been) (saved|changed)/i);
  });

  it("lets redirect() through, because Next signals it by throwing", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/admin/claims;307;",
    });
    const action = vi.fn(async () => {
      throw redirectError;
    });

    await expect(
      resilient(action as never)(idleState, form({})),
    ).rejects.toBe(redirectError);
  });

  it("lets notFound() through for the same reason", async () => {
    const notFoundError = Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_NOT_FOUND",
    });
    const action = vi.fn(async () => {
      throw notFoundError;
    });

    await expect(
      resilient(action as never)(idleState, form({})),
    ).rejects.toBe(notFoundError);
  });

  it("passes a successful result through untouched", async () => {
    const success: FormState = { status: "success", message: "Saved." };
    const action = vi.fn(async () => success);

    const state = await resilient(action)(idleState, form({ a: "b" }));

    expect(state).toBe(success);
    expect(action).toHaveBeenCalledOnce();
  });

  it("keeps a state shape it does not know about", async () => {
    // `EnrollmentState` carries `factorId`, `qrCode` and `secret`, and the MFA
    // setup screen renders from them. Replacing the state with a bare error
    // would blank the QR code the operator is halfway through scanning.
    const previous = {
      status: "ready" as const,
      factorId: "f-1",
      qrCode: "data:image/svg+xml,…",
      secret: "ZRQ6XR2OP7HI6YEK",
    };
    const action = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const state = await resilient(action as never)(previous, form({}));

    expect(state.status).toBe("error");
    expect(state).toMatchObject({
      factorId: "f-1",
      secret: "ZRQ6XR2OP7HI6YEK",
    });
  });
});
