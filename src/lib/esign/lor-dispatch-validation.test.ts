// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const { sendLorRequestFixture } = await import("./fixtures");
const { ManualSignProvider } = await import("./manual");
const { dispatchLorForClaim } = await import("./lor-dispatch");
const support = await import("./test-support");
type TestAdmin = Awaited<ReturnType<typeof support.testAdminClient>>;

const available = await support.localSupabaseAvailable();
const describeDb = available ? describe : describe.skip;

describeDb("LOR dispatch validation", () => {
  let admin: TestAdmin;
  const created: Array<{ id: string; claimRef: string }> = [];

  beforeAll(() => {
    process.env.RESEND_API_KEY = "";
    admin = support.testAdminClient();
  });

  afterAll(async () => {
    for (const claim of created) await support.cleanupClaim(admin, claim.id, claim.claimRef);
  });

  it("refuses a claim that is not ready for a letter", async () => {
    const { data: claim } = await admin.from("claims").insert({
      claim_ref: support.fixtureClaimRef(),
      property_street: "9 Too Early Lane",
      property_city: "Orlando",
      property_state: "Florida",
      property_zip: "32801",
      carrier: "Citizens",
      policy_number: "POL-EARLY",
      lor_contract_type: "non_emergency",
      carrier_tenure: "lt_1_year",
      prior_roof_claim: false,
      loss_date: "2026-07-02",
      cause: "wind",
      description: "not yet reviewed",
    }).select("id, claim_ref").single();
    created.push({ id: claim!.id, claimRef: claim!.claim_ref });

    await expect(dispatchLorForClaim(
      { claimId: claim!.id },
      { admin, provider: new ManualSignProvider() },
    )).resolves.toMatchObject({ ok: false, code: "invalid_status" });
  });

  it("refuses missing policy data before producing a letter", async () => {
    const claim = await support.seedClaim(admin, { status: "under_review" });
    created.push({ id: claim.id, claimRef: claim.claimRef });
    await admin.from("claims").update({ carrier: null, policy_number: null })
      .eq("id", claim.id);
    const provider = new ManualSignProvider();
    const dispatch = vi.spyOn(provider, "dispatchLor");

    await expect(dispatchLorForClaim(
      { claimId: claim.id },
      { admin, provider },
    )).resolves.toMatchObject({ ok: false, code: "missing_policy" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("refuses to guess which agreement checkbox applies", async () => {
    const claim = await support.seedClaim(admin, { status: "under_review" });
    created.push({ id: claim.id, claimRef: claim.claimRef });
    await admin.from("claims").update({ lor_contract_type: null }).eq("id", claim.id);
    const provider = new ManualSignProvider();
    const dispatch = vi.spyOn(provider, "dispatchLor");

    await expect(dispatchLorForClaim(
      { claimId: claim.id },
      { admin, provider },
    )).resolves.toMatchObject({ ok: false, code: "missing_lor_type" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("refuses a claim id that does not exist", async () => {
    await expect(dispatchLorForClaim(
      { claimId: sendLorRequestFixture().claimId },
      { admin, provider: new ManualSignProvider() },
    )).resolves.toMatchObject({ ok: false, code: "claim_not_found" });
  });
});
