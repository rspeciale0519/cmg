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
      ia2: { value: "", role: "H1" },
      da2: { value: "", role: "H1" },
      s9: { value: "", role: "H1" },
      j1: { value: "", role: "H2" },
      ja2: { value: "", role: "H2" },
      t9: { value: "", role: "H2" },
      d1: { value: "08/14/2026", role: "H1" },
    });
    expect(JSON.stringify(fields)).not.toContain("must not enter the PDF");
  });

  it.each([1, 2])("maps all signing slots without choosing optional consent for %i signer(s)", (signerCount) => {
    const request = sendLorRequestFixture({
      tokens: [{ name: "da2", value: "08/01/2026" }],
    });
    const fields = buildLorPdfFields(
      { ...request, signers: request.signers.slice(0, signerCount) },
      new Date("2026-08-14T16:00:00Z"),
    );
    const h1 = ["i1", "ia2", "da2", "i2", "i3", "i4", "s5", "s6", "s7", "i8", "s9"];
    const h2 = ["j1", "ja2", "j2", "j3", "j4", "t5", "t6", "t7", "j8", "t9"];

    for (const id of h1) expect(fields[id], id).toEqual({ value: "", role: "H1" });
    for (const id of h2) {
      if (signerCount === 2) expect(fields[id], id).toEqual({ value: "", role: "H2" });
      else expect(fields).not.toHaveProperty(id);
    }
    expect(fields.d2).toEqual({ value: "08/14/2026", role: "H1" });
    expect(Object.keys(fields).filter((id) => ![
      "ph", "carrier", "policy", "property", "lossdate", "cause", "fee", "claimno",
      "accepted", "adjuster", "phone", "email", "em", "ne", "su",
      "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9a", "d9b",
    ].includes(id)).sort()).toEqual([...h1, ...(signerCount === 2 ? h2 : [])].sort());
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
