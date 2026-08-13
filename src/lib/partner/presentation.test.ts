import { describe, expect, it } from "vitest";
import { partnerMilestones } from "./presentation";

describe("partnerMilestones", () => {
  it("shows only completed milestones in business order", () => {
    expect(partnerMilestones({
      lor_signed_at: "2026-05-01T12:00:00Z",
      filed_at: "2026-05-03T12:00:00Z",
      settled_at: null,
    })).toEqual([
      { label: "LOR signed", at: "2026-05-01T12:00:00Z" },
      { label: "Filed", at: "2026-05-03T12:00:00Z" },
    ]);
  });

  it("does not invent pending milestone dates", () => {
    expect(partnerMilestones({
      lor_signed_at: null,
      filed_at: null,
      settled_at: null,
    })).toEqual([]);
  });
});
