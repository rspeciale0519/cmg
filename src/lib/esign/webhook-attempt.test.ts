import { describe, expect, it } from "vitest";
import { classifyWebhookAttempt } from "./webhook-attempt";

const current = {
  esignStatus: "document.sent",
  currentDocumentId: "pd-new",
  activeAttemptToken: "22222222-2222-4222-8222-222222222222",
  dispatchToken: null,
};

describe("classifyWebhookAttempt", () => {
  it.each([
    ["manual fallback", { ...current, esignStatus: "manual_pending", currentDocumentId: null }, { documentId: "pd-old", attemptToken: "11111111-1111-4111-8111-111111111111" }],
    ["superseded document", current, { documentId: "pd-old", attemptToken: current.activeAttemptToken }],
    ["superseded token", current, { documentId: "pd-new", attemptToken: "11111111-1111-4111-8111-111111111111" }],
    ["missing token on a token-bound document", current, { documentId: "pd-new", attemptToken: null }],
  ])("marks %s as stale", (_name, claim, event) => {
    expect(classifyWebhookAttempt(claim, event)).toBe("stale");
  });

  it("recognizes the newly-owned token before its document id is persisted", () => {
    expect(classifyWebhookAttempt(
      { ...current, currentDocumentId: "pd-old", activeAttemptToken: "old", dispatchToken: "new" },
      { documentId: "pd-new", attemptToken: "new" },
    )).toBe("dispatch_in_flight");
  });

  it("accepts the new document only after document and active token agree", () => {
    expect(classifyWebhookAttempt(current, {
      documentId: current.currentDocumentId,
      attemptToken: current.activeAttemptToken,
    })).toBe("current");
  });

  it("keeps matching pre-token legacy documents operable", () => {
    expect(classifyWebhookAttempt(
      { ...current, activeAttemptToken: null },
      { documentId: "pd-new", attemptToken: null },
    )).toBe("current");
  });
});
