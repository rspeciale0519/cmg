import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The stand-in wraps the real primitive rather than replacing it, so every
 * test below runs against genuine constant-time comparison — while one test
 * seizes the verdict, which is how "the answer *is* the constant-time
 * comparison's answer" gets proved rather than asserted.
 */
const probe = vi.hoisted(() => ({
  calls: [] as Array<[Uint8Array, Uint8Array]>,
  verdict: null as boolean | null,
}));

vi.mock("./constant-time", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./constant-time")>();
  return {
    constantTimeEquals: (a: Uint8Array, b: Uint8Array) => {
      probe.calls.push([a, b]);
      return probe.verdict ?? actual.constantTimeEquals(a, b);
    },
  };
});

const { signWebhookBody, verifyWebhookSignature } = await import("./signature");

const KEY = "shared-key-from-the-pandadoc-subscription";
const BODY = JSON.stringify([
  { event: "document_state_changed", data: { id: "doc-1", status: "document.sent" } },
]);

beforeEach(() => {
  probe.calls.length = 0;
  probe.verdict = null;
});

describe("verifyWebhookSignature", () => {
  it("accepts the signature PandaDoc would send for these exact bytes", () => {
    expect(verifyWebhookSignature(KEY, BODY, signWebhookBody(KEY, BODY))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = signWebhookBody(KEY, BODY);
    const tampered = BODY.replace("document.sent", "document.completed");

    expect(tampered).not.toBe(BODY);
    expect(verifyWebhookSignature(KEY, tampered, signature)).toBe(false);
  });

  it("rejects a signature made with a different shared key", () => {
    expect(verifyWebhookSignature(KEY, BODY, signWebhookBody("some-other-key", BODY))).toBe(
      false,
    );
  });

  it("rejects a missing signature", () => {
    expect(verifyWebhookSignature(KEY, BODY, null)).toBe(false);
    expect(verifyWebhookSignature(KEY, BODY, undefined)).toBe(false);
    expect(verifyWebhookSignature(KEY, BODY, "")).toBe(false);
  });

  it("rejects malformed hex without reaching the comparison", () => {
    const valid = signWebhookBody(KEY, BODY);
    const candidates = [
      "zz".repeat(32),
      valid.slice(0, 63),
      `${valid}ab`,
      "not-hex-at-all",
      valid.replace(/.$/, "g"),
    ];

    for (const candidate of candidates) {
      expect(verifyWebhookSignature(KEY, BODY, candidate)).toBe(false);
    }

    expect(probe.calls).toHaveLength(0);
  });

  it("rejects when no shared key is configured", () => {
    expect(verifyWebhookSignature(null, BODY, signWebhookBody("", BODY))).toBe(false);
    expect(verifyWebhookSignature("", BODY, signWebhookBody("", BODY))).toBe(false);
    expect(verifyWebhookSignature(undefined, BODY, signWebhookBody("", BODY))).toBe(false);
  });

  it("is case-insensitive about hex, as hex is", () => {
    expect(verifyWebhookSignature(KEY, BODY, signWebhookBody(KEY, BODY).toUpperCase())).toBe(
      true,
    );
  });
});

describe("timing safety by construction", () => {
  it("routes a well-formed but wrong signature through the constant-time compare", () => {
    const wrong = createHmac("sha256", "wrong-key").update(BODY).digest("hex");

    expect(verifyWebhookSignature(KEY, BODY, wrong)).toBe(false);
    expect(probe.calls).toHaveLength(1);

    const [candidate, expected] = probe.calls[0];
    expect(candidate).toHaveLength(32);
    expect(expected).toHaveLength(32);
  });

  it("returns exactly what the constant-time compare returns — there is no second check", () => {
    /* If any `===`, prefix compare or early exit existed alongside it, one of
       these two would disagree with the forced verdict. Both follow it, so the
       constant-time compare is the whole decision for a well-formed
       candidate. */
    const wrong = createHmac("sha256", "wrong-key").update(BODY).digest("hex");

    probe.verdict = true;
    expect(verifyWebhookSignature(KEY, BODY, wrong)).toBe(true);

    probe.verdict = false;
    expect(verifyWebhookSignature(KEY, BODY, signWebhookBody(KEY, BODY))).toBe(false);
  });

  it("hands the compare two buffers of equal length, so timingSafeEqual cannot throw", () => {
    for (const candidate of ["ab".repeat(32), "cd".repeat(32), signWebhookBody(KEY, BODY)]) {
      verifyWebhookSignature(KEY, BODY, candidate);
    }

    expect(probe.calls).toHaveLength(3);
    for (const [a, b] of probe.calls) {
      expect(a.length).toBe(b.length);
    }
  });
});

describe("constantTimeEquals", () => {
  it("refuses unequal lengths instead of letting timingSafeEqual throw", async () => {
    const { constantTimeEquals } = await vi.importActual<
      typeof import("./constant-time")
    >("./constant-time");

    expect(constantTimeEquals(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(constantTimeEquals(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(constantTimeEquals(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
  });
});
