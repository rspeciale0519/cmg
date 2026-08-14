// @vitest-environment node
import { loadEnvFile } from "node:process";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
loadEnvFile(".env.local");

const { PandaDocClient } = await import("./pandadoc-client");
const { buildLorPdfFields, loadLorPdf, lorPdfName, pandaDocRecipients } = await import("./lor-pdf");
const { sendLorRequestFixture } = await import("./fixtures");

const runLive =
  process.env.PANDADOC_LIVE_DRAFT_TEST === "1" &&
  Boolean(process.env.PANDADOC_API_KEY) &&
  Boolean(process.env.PANDADOC_DRAFT_TEST_EMAIL);

const describeLive = runLive ? describe : describe.skip;

describeLive("PandaDoc live draft verification", () => {
  it("creates a draft from the bundled single-owner PDF without sending it", async () => {
    const email = process.env.PANDADOC_DRAFT_TEST_EMAIL!;
    const client = new PandaDocClient({
      apiKey: process.env.PANDADOC_API_KEY!,
      baseUrl: process.env.PANDADOC_API_BASE_URL ?? "https://api.pandadoc.com/public/v1",
      pollIntervalMs: 2000,
      pollMaxAttempts: 25,
    });
    const request = sendLorRequestFixture({
      documentName: "[DEV] CMG LOR FINAL FIELD TEST - DO NOT SEND",
      signers: [
        {
          email,
          phone: "407-555-0100",
          firstName: "Rob",
          lastName: "Test Homeowner",
          role: "Homeowner1",
        },
      ],
      tokens: [
        { name: "Policyholders.Name", value: "Rob Test Homeowner" },
        { name: "Claim.Carrier", value: "Test Carrier" },
        { name: "Claim.PolicyNumber", value: "POL-TEST-2026" },
        { name: "Claim.ClaimNumber", value: "CLM-TEST-2026" },
        { name: "Claim.LossDate", value: "08/01/2026" },
        { name: "Claim.Cause", value: "Wind" },
        { name: "Property.Address", value: "100 Test Way, Orlando, Florida 32801" },
        { name: "Homeowner1.Phone", value: "407-555-0100" },
        { name: "Homeowner1.Email", value: email },
        { name: "Claim.EmergencyMark", value: "" },
        { name: "Claim.NonEmergencyMark", value: "X" },
        { name: "Claim.SupplementalMark", value: "" },
        { name: "Adjuster.Name", value: "Test Adjuster" },
        { name: "Fee.Percent", value: "10%" },
      ],
    });

    const document = await client.withOperationDeadline(async (operation) => {
      const created = await client.createDocumentFromPdf(
        await loadLorPdf(1),
        lorPdfName(1),
        {
          name: request.documentName,
          recipients: pandaDocRecipients(request),
          fields: buildLorPdfFields(request, new Date("2026-08-14T16:00:00Z")),
          parse_form_fields: false,
          metadata: {
            claim_id: request.claimId,
            dispatch_attempt_token: request.dispatchAttemptToken,
          },
        },
        operation,
      );
      return client.waitForDraft(created.id, operation);
    });

    expect(document.status).toBe("document.draft");
    console.info(`[esign] PandaDoc draft verified: ${document.id}`);
  });
});
