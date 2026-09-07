// @vitest-environment node
import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildLorPdfFields, lorPdfName, pandaDocRecipients } = await import("./lor-pdf");
const { sendLorRequestFixture } = await import("./fixtures");

describe("bundled LOR PDF mapping", () => {
  it("keeps both one-owner and two-owner PDFs in the server source", async () => {
    for (const count of [1, 2]) {
      const filename = lorPdfName(count);
      await expect(
        access(path.join(process.cwd(), "src", "lib", "esign", "templates", filename)),
      ).resolves.toBeUndefined();
    }
  });

  it("maps only LOR data into the PDF and leaves signatures blank", () => {
    const request = sendLorRequestFixture({
      tokens: [
        { name: "Policyholders.Name", value: "Dana Roe and Robin Roe" },
        { name: "Claim.Carrier", value: "Citizens" },
        { name: "Claim.PolicyNumber", value: "POL-42" },
        { name: "Homeowner1.Email", value: "dana@example.com" },
        { name: "Claim.EmergencyMark", value: "X" },
        { name: "Unrelated.DatabaseOnlyValue", value: "must not enter the PDF" },
      ],
    });

    const fields = buildLorPdfFields(request, new Date("2026-08-14T16:00:00Z"));

    expect(fields).toMatchObject({
      ph: { value: "Dana Roe and Robin Roe", role: "H1" },
      carrier: { value: "Citizens", role: "H1" },
      policy: { value: "POL-42", role: "H1" },
      email: { value: "dana@example.com", role: "H1" },
      em: { value: "X", role: "H1" },
      i1: { value: "", role: "H1" },
      s9: { value: "", role: "H1" },
      j1: { value: "", role: "H2" },
      t9: { value: "", role: "H2" },
      d1: { value: "08/14/2026", role: "H1" },
    });
    expect(JSON.stringify(fields)).not.toContain("must not enter the PDF");
  });

  it("uses PandaDoc roles H1 and H2 without changing internal claimant roles", () => {
    const request = sendLorRequestFixture();
    expect(pandaDocRecipients(request).map((recipient) => recipient.role)).toEqual([
      "H1",
      "H2",
    ]);
    expect(request.signers.map((signer) => signer.role)).toEqual([
      "Homeowner1",
      "Homeowner2",
    ]);
  });
});
