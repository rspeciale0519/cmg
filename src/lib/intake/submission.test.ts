import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildIntakeSubmission, parseIntakeInput } from "./submission";
import { intakeFixtureInput } from "./test-fixtures";

describe("contractor intake serialization", () => {
  it("records a server-resolved vendor without assigning claim access", () => {
    const vendor = { id: "40000000-0000-4000-a000-000000000010", name: "Trusted Vendor" };
    const result = buildIntakeSubmission({ ...intakeFixtureInput(), contractorCompany: "Different supplied company" }, [], null, vendor);
    expect(result.claim.intake_referral_partner_id).toBe(vendor.id);
    expect(result.claim).not.toHaveProperty("partner_company_id");
    expect(result.outbox[0].payload).toMatchObject({ referralVendor: vendor.name });
    expect(result.claim.contractor_company).toBe("Different supplied company");
  });
  it.each([false, true])("keeps homeowner identity with attachments=%s", (hasFile) => {
    const input = {
      ...intakeFixtureInput(), lossTime: undefined,
      contractorName: "Test Contractor", contractorCompany: "Test Roofing",
      contractorPhone: "4075550101", contractorEmail: "contractor@example.invalid",
    };
    const result = buildIntakeSubmission(input, hasFile ? [{
      path: "intake/test/scan.pdf", originalName: "scan.pdf", mime: "application/pdf", size: 10,
    }] : [], null);
    expect(result.claim).toMatchObject({
      loss_time: null, contractor_name: input.contractorName,
      contractor_company: input.contractorCompany, contractor_phone: input.contractorPhone,
      contractor_email: input.contractorEmail,
    });
    expect(result.claim).not.toHaveProperty("partner_company_id");
    expect(result.claimants).toHaveLength(1);
    expect(result.claimants[0]).toMatchObject({ email: input.email, phone: input.phone });
    expect(result.consents.every((row) => row.email === input.email && row.phone === input.phone)).toBe(true);
    expect(result.outbox.map((row) => row.recipient_email)).not.toContain(input.contractorEmail);
    expect(result.outbox[1].recipient_email).toBe(input.email);
    expect(result.outbox[0].payload).toMatchObject({ contractorName: input.contractorName, documentCount: hasFile ? 1 : 0 });
  });

  it("preserves older times and permits homeowner-only submissions", () => {
    const result = buildIntakeSubmission(intakeFixtureInput(), [], null);
    expect(result.claim.loss_time).toBe("16:30");
    expect(result.claim.contractor_name).toBeNull();
    expect(result.claim.contractor_email).toBeNull();
  });

  it("parses optional contractor fields without accepting partner assignment", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(intakeFixtureInput())) {
      if (value !== undefined) form.set(key, String(value));
    }
    form.set("consent", "on");
    form.set("cf-turnstile-response", "test-token");
    form.delete("lossTime");
    form.set("contractorName", "  Test Contractor  ");
    form.set("contractorCompany", "  Test Roofing  ");
    form.set("contractorPhone", "4075550101");
    form.set("contractorEmail", "contractor@example.invalid");
    form.set("partner_company_id", "00000000-0000-0000-0000-000000000001");
    const result = parseIntakeInput(form);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ contractorName: "Test Contractor", contractorCompany: "Test Roofing" });
    expect(result.data.lossTime).toBeUndefined();
    expect(result.data).not.toHaveProperty("partner_company_id");
  });
});
