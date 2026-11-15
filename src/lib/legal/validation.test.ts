import { describe, expect, it } from "vitest";
import { milestoneSchema, packageSchema, allowedMilestones } from "./validation";

const id = "11111111-1111-4111-8111-111111111111";
describe("legal milestone input", () => {
  it("requires an explicit return stage", () => {
    expect(milestoneSchema.safeParse({ handoffId: id, requestId: id, expectedVersion: 2, milestone: "returned", occurredOn: "2026-01-10", returnStatus: "" }).success).toBe(false);
  });
  it("does not accept a return stage on an acceptance", () => {
    expect(milestoneSchema.safeParse({ handoffId: id, requestId: id, expectedVersion: 2, milestone: "accepted", occurredOn: "2026-01-10", returnStatus: "denied" }).success).toBe(false);
  });
  it("refuses impossible dates", () => {
    expect(milestoneSchema.safeParse({ handoffId: id, requestId: id, expectedVersion: 2, milestone: "accepted", occurredOn: "2026-02-30", returnStatus: "" }).success).toBe(false);
  });
  it("does not skip acceptance before a lawsuit", () => {
    expect(allowedMilestones("sent")).toEqual(["accepted", "declined", "returned"]);
    expect(allowedMilestones("accepted")).toEqual(["lawsuit_filed", "returned"]);
  });
});
describe("legal package input", () => {
  it("rejects foreign summary field names", () => {
    expect(packageSchema.safeParse({ handoffId: id, requestId: id, documentIds: [id], summaryFields: ["financial_notes"], summaryNote: "" }).success).toBe(false);
  });
  it("requires at least one original document and rejects duplicate IDs", () => {
    const input = { handoffId: id, requestId: id, documentIds: [], summaryFields: ["claim"], summaryNote: "" };
    expect(packageSchema.safeParse(input).success).toBe(false);
    expect(packageSchema.safeParse({ ...input, documentIds: [id, id] }).success).toBe(false);
  });
});
