import { describe, expect, it } from "vitest";
import { progressFor } from "./progress";

describe("optional legal branch", () => {
  it("does not invent documentation or filing after an early handoff", () => {
    const progress = progressFor("with_law_firm", [
      { to_status: "lor_signed", created_at: "2026-01-01T00:00:00Z" },
      { to_status: "with_law_firm", created_at: "2026-01-02T00:00:00Z" },
    ]);
    expect(progress?.currentIndex).toBe(1);
    expect(progress?.stages[2].state).toBe("upcoming");
    expect(progress?.stages[3].state).toBe("upcoming");
    expect(progress?.now).toContain("law firm");
  });
  it("uses the latest ordinary history independent of input order", () => {
    const progress = progressFor("with_law_firm", [
      { to_status: "filed", created_at: "2026-01-02T00:00:00Z" },
      { to_status: "lor_signed", created_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(progress?.currentIndex).toBe(3);
  });
});
