import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILE_BYTES } from "@/lib/validators/files";

const stub = vi.hoisted(() => ({
  rate: vi.fn(async () => true),
  check: vi.fn(async (_rule: unknown, _identifier: string) => true),
  turnstile: vi.fn(async () => ({ ok: true })),
  prepare: vi.fn(),
  finalize: vi.fn(),
  admin: vi.fn(() => ({ marker: "local-stub" })),
  referral: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: { intakeIp: {}, intakeEmail: {}, intakeFinalizeIp: {}, intakeFinalizeToken: {} },
  checkFormRateLimits: stub.rate, checkRateLimit: stub.check,
  clientIpFromHeaders: () => "203.0.113.9", inetOrNull: (value: string) => value,
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: stub.turnstile }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: stub.admin }));
vi.mock("@/lib/intake/referral", () => ({ resolveIntakeReferral: stub.referral }));
vi.mock("@/lib/intake/upload-session", async (original) => ({
  ...await original<typeof import("@/lib/intake/upload-session")>(),
  prepareIntakeSession: stub.prepare, finalizeIntakeSession: stub.finalize,
}));
import { finalizeIntakeUpload, submitIntake } from "./intake";
import { idleState } from "./types";

function intakeForm(): FormData {
  const data = new FormData();
  const fields = {
    firstName: "Dana",
    lastName: "Test",
    email: "dana@example.com",
    phone: "407-555-0119",
    initials: "dt",
    hasSecondPolicyholder: "no",
    carrier: "Citizens",
    policyNumber: "POL-TEST-1",
    carrierTenure: "three_plus_years",
    priorRoofClaim: "no",
    lorContractType: "non_emergency",
    lossDate: "2026-07-14",
    lossTime: "16:30",
    cause: "wind_hail",
    description: "Roof damage with leaks inside the home.",
    street: "100 Test Way",
    city: "Orlando",
    state: "Florida",
    zip: "32801",
    requestedAdjuster: "austin-graham",
    consent: "on",
    "cf-turnstile-response": "test-token",
  };
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  data.set("uploadManifest", "[]");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.rate.mockResolvedValue(true);
  stub.check.mockResolvedValue(true);
  stub.turnstile.mockResolvedValue({ ok: true });
  stub.referral.mockResolvedValue({ ok: true, partner: null });
  stub.prepare.mockResolvedValue({ status: "idle", uploadSession: { id: "session" } });
  stub.finalize.mockResolvedValue({ status: "success", reference: "CMG-2099-0207" });
});

describe("private intake upload gates", () => {
  it("rejects an unavailable referral before reserving upload paths", async () => {
    const form = intakeForm();
    form.set("vendorReferralCode", "40000000-0000-4000-a000-000000000001");
    stub.referral.mockResolvedValueOnce({ ok: false });
    const result = await submitIntake(idleState, form);
    expect(result.status).toBe("error");
    expect(stub.prepare).not.toHaveBeenCalled();
  });

  it("passes only the server-resolved vendor to upload preparation", async () => {
    const form = intakeForm();
    form.set("vendorReferralCode", "40000000-0000-4000-a000-000000000001");
    form.set("intake_referral_partner_id", "forged");
    const partner = { id: "40000000-0000-4000-a000-000000000010", name: "Trusted Vendor" };
    stub.referral.mockResolvedValueOnce({ ok: true, partner });
    await submitIntake(idleState, form);
    expect(stub.prepare.mock.calls[0][4]).toEqual(partner);
    expect(stub.prepare.mock.calls[0][1]).not.toHaveProperty("intake_referral_partner_id");
  });

  it("does not reserve paths before rate limits and Turnstile succeed", async () => {
    stub.rate.mockResolvedValueOnce(false);
    expect((await submitIntake(idleState, intakeForm())).status).toBe("error");
    expect(stub.turnstile).not.toHaveBeenCalled();
    expect(stub.prepare).not.toHaveBeenCalled();
    stub.turnstile.mockResolvedValueOnce({ ok: false });
    expect((await submitIntake(idleState, intakeForm())).status).toBe("error");
    expect(stub.prepare).not.toHaveBeenCalled();
  });

  it("validates the full intake before creating an upload session", async () => {
    const form = intakeForm();
    form.delete("firstName");
    const state = await submitIntake(idleState, form);
    expect(state.fieldErrors?.firstName).toBeDefined();
    expect(stub.prepare).not.toHaveBeenCalled();
  });

  it("rejects a public multipart byte upload before reserving paths", async () => {
    const form = intakeForm();
    form.append("documents", new File(["%PDF-1.7"], "roof.pdf", { type: "application/pdf" }));
    expect((await submitIntake(idleState, form)).fieldErrors?.documents).toBeDefined();
    expect(stub.prepare).not.toHaveBeenCalled();
  });

  it.each([
    "invalid JSON",
    JSON.stringify(Array.from({ length: 11 }, () => ({ name: "roof.pdf", size: 64, mime: "application/pdf" }))),
    JSON.stringify([{ name: "roof.pdf", size: MAX_FILE_BYTES + 1, mime: "application/pdf" }]),
    JSON.stringify([{ name: "roof.pdf", size: 0, mime: "application/pdf" }]),
    JSON.stringify([{ name: "roof.pdf", size: 1.5, mime: "application/pdf" }]),
    JSON.stringify([{ name: "roof.pdf", size: 64, mime: "constructor" }]),
    JSON.stringify([{ name: "roof.pdf", size: 64, mime: "application/pdf", path: "caller-chosen.pdf" }]),
  ])("refuses an invalid manifest before issuing upload authority", async (manifest) => {
    const form = intakeForm();
    form.set("uploadManifest", manifest);
    expect((await submitIntake(idleState, form)).fieldErrors?.documents).toBeDefined();
    expect(stub.prepare).not.toHaveBeenCalled();
  });

  it("preserves the ten-file and exact 25 MiB allowance", async () => {
    const form = intakeForm();
    form.set("uploadManifest", JSON.stringify(Array.from({ length: 10 }, (_, index) => ({
      name: index + ".pdf", size: MAX_FILE_BYTES, mime: "application/pdf",
    }))));
    expect((await submitIntake(idleState, form)).uploadSession).toBeDefined();
    expect(stub.prepare).toHaveBeenCalledOnce();
    expect(stub.prepare.mock.calls[0][2]).toHaveLength(10);
    expect(stub.admin).toHaveBeenCalledOnce();
  });

  it("retries finalization with the same capability without spending Turnstile again", async () => {
    const id = "20000000-0000-4000-a000-0000000000c1";
    const token = "x".repeat(43);
    expect((await finalizeIntakeUpload(id, token)).status).toBe("success");
    expect(stub.finalize).toHaveBeenCalledWith({ marker: "local-stub" }, id, token);
    expect(stub.prepare).not.toHaveBeenCalled();
    expect(stub.turnstile).not.toHaveBeenCalled();
    expect(stub.check).toHaveBeenCalledTimes(2);
    expect(String(stub.check.mock.calls[1][1])).not.toContain(token);
  });

  it("does not grant restart after an unknown finalization result", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      stub.finalize.mockRejectedValueOnce(new Error("sensitive provider response"));
      const state = await finalizeIntakeUpload("20000000-0000-4000-a000-0000000000c1", "x".repeat(43));
      expect(state.status).toBe("error");
      expect(state.restartAllowed).not.toBe(true);
      expect(state.message).not.toContain("sensitive");
      expect(log).toHaveBeenCalledWith("[intake] confirmation unavailable");
    } finally { log.mockRestore(); }
  });

  it("refuses an invalid capability without a session lookup", async () => {
    expect((await finalizeIntakeUpload("other", "short")).status).toBe("error");
    expect(stub.finalize).not.toHaveBeenCalled();
    expect(stub.admin).not.toHaveBeenCalled();
  });
});
