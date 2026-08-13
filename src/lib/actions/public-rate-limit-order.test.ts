import { beforeEach, describe, expect, it, vi } from "vitest";

const stub = vi.hoisted(() => ({
  checkFormRateLimits: vi.fn(async () => false),
  verifyTurnstile: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.9" })),
}));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {
    contactIp: { scope: "contact:ip", max: 1, window: "1 hour" },
    contactEmail: { scope: "contact:email", max: 1, window: "1 hour" },
    intakeIp: { scope: "intake:ip", max: 1, window: "1 hour" },
    intakeEmail: { scope: "intake:email", max: 1, window: "1 hour" },
  },
  checkFormRateLimits: stub.checkFormRateLimits,
  clientIpFromHeaders: vi.fn(() => "203.0.113.9"),
  inetOrNull: vi.fn((value: string) => value),
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: stub.verifyTurnstile }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    throw new Error("a rate-limited request must not create an admin client");
  }),
}));
vi.mock("@/lib/email/outbox", () => ({
  dispatchOutbox: vi.fn(),
  outboxRows: vi.fn(),
  staffInbox: vi.fn(() => "staff@example.com"),
}));
vi.mock("./intake-storage", () => ({
  removeObjects: vi.fn(),
  uploadIntakeFiles: vi.fn(),
}));

import { submitContact } from "./contact";
import { submitIntake } from "./intake";
import { idleState } from "./types";

function form(): FormData {
  const data = new FormData();
  data.set("email", "homeowner@example.com");
  data.set("cf-turnstile-response", "single-use-token");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.checkFormRateLimits.mockResolvedValue(false);
});

describe("public form abuse gates", () => {
  it.each([
    ["contact", submitContact],
    ["intake", submitIntake],
  ] as const)(
    "rate-limits %s before spending a Turnstile verification",
    async (_name, action) => {
      const state = await action(idleState, form());

      expect(state.status).toBe("error");
      expect(state.message).toMatch(/several submissions/i);
      expect(stub.checkFormRateLimits).toHaveBeenCalledOnce();
      expect(stub.verifyTurnstile).not.toHaveBeenCalled();
    },
  );
});
