import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createPackageSummaryPdf, wrapSummaryLine } from "./package-summary";

describe("package summary", () => {
  it("wraps long Unicode values without losing code points", () => {
    const text = "合同".repeat(70);
    const lines = wrapSummaryLine(text, 12, value => Array.from(value).length);
    expect(lines.join("")).toBe(text);
    expect(lines.every(line => Array.from(line).length <= 12)).toBe(true);
  });
  it("keeps blank lines and wraps words", () => {
    expect(wrapSummaryLine("", 10, value => value.length)).toEqual([""]);
    expect(wrapSummaryLine("one two three four", 9, value => value.length)).toEqual(["one two", "three", "four"]);
  });
  it("creates a readable multipage PDF for a long reviewed summary", async () => {
    const bytes = await createPackageSummaryPdf("Synthetic summary\n".repeat(95));
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(3);
    expect(pdf.getTitle()).toBe("CMG claim handoff summary");
  });
});
