import { describe, expect, it } from "vitest";
import { isDocumentStoragePath } from "./storage-path";

const claimId = "20000000-0000-4000-a000-000000000001";
const intakeId = "40000000-0000-4000-a000-000000000001";
const prefix = `claims/${claimId}`;

describe("document storage paths", () => {
  it.each([
    `${prefix}/evidence.pdf`,
    `${prefix}/folder/scan-1.pdf`,
    `${prefix}/pandadoc-123.pdf`,
    `${prefix}/pandadoc-123:1.pdf`,
    `${prefix}/_original.JPG`,
    `intake/${intakeId}/evidence.pdf`,
    `intake/${intakeId.toUpperCase()}/evidence.pdf`,
  ])("accepts a canonical generated path: %s", (path) => {
    expect(isDocumentStoragePath(path, claimId)).toBe(true);
  });

  it.each([
    "",
    `${prefix}/`,
    `${prefix}//evidence.pdf`,
    `${prefix}/./evidence.pdf`,
    `${prefix}/../evidence.pdf`,
    `${prefix}/evidence.pdf?download=other`,
    `${prefix}/evidence.pdf#other`,
    `${prefix}/evidence%20copy.pdf`,
    `${prefix}/folder\\evidence.pdf`,
    `${prefix}/evidence copy.pdf`,
    `${prefix}/evidence.pdf\n`,
    `${prefix}/evidence.pdf\r`,
    `/${prefix}/evidence.pdf`,
    `claims/${intakeId}/evidence.pdf`,
    `intake/${intakeId}/nested/evidence.pdf`,
    "intake/not-a-uuid/evidence.pdf",
    `other/${claimId}/evidence.pdf`,
  ])("refuses a noncanonical path: %s", (path) => {
    expect(isDocumentStoragePath(path, claimId)).toBe(false);
  });

  it("refuses a malformed claim id", () => {
    expect(isDocumentStoragePath(`${prefix}/evidence.pdf`, "invalid")).toBe(false);
    expect(isDocumentStoragePath(`${prefix}/evidence.pdf`, `${claimId}\n`)).toBe(false);
  });
});
