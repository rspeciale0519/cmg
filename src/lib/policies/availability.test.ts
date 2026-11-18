import { describe, expect, it } from "vitest";
import { POLICY_REVISION, policyAvailability } from "./availability";

describe("public policy publication boundary", () => {
  it("keeps unapproved pages unavailable by default", () => {
    expect(policyAvailability({})).toBe("hidden");
  });

  it.each(["production", "test", undefined])(
    "does not expose a draft with NODE_ENV=%s",
    (nodeEnv) => {
      expect(policyAvailability({ nodeEnv, previewDrafts: "true" })).toBe("hidden");
    },
  );

  it("allows an explicit local development preview", () => {
    expect(policyAvailability({ nodeEnv: "development", previewDrafts: "true" })).toBe("draft");
  });

  it.each([
    { vercel: "1" },
    { vercel: "0" },
    { vercelEnvironment: "preview" },
    { vercelEnvironment: "production" },
  ])("refuses a hosted draft with %j", (host) => {
    expect(policyAvailability({ nodeEnv: "development", previewDrafts: "true", ...host })).toBe("hidden");
  });

  it.each(["true", "1", "2026-11-14", " 2026-11-15 "])(
    "requires exact approval of the content revision, not %j",
    (approvedRevision) => {
      expect(policyAvailability({ nodeEnv: "production", approvedRevision })).toBe("hidden");
    },
  );

  it("publishes only the approved revision", () => {
    expect(policyAvailability({
      nodeEnv: "production", vercel: "1", approvedRevision: POLICY_REVISION,
    })).toBe("published");
  });
});
