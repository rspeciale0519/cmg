// @vitest-environment node
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const slot = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => slot.client,
}));

const { loadPartnerPage } = await import("./partners");
const { localSupabaseAvailable, testAdminClient } = await import("@/lib/esign/test-support");

const describeDb = (await localSupabaseAvailable()) ? describe : describe.skip;

function totp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const bytes = Buffer.from(
    bits.match(/.{8}/g)?.map((octet) => Number.parseInt(octet, 2)) ?? [],
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", bytes).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

describeDb("partner directory with authenticated column grants", () => {
  let admin: ReturnType<typeof testAdminClient>;
  let fixtureUserId: string | null = null;

  beforeAll(async () => {
    admin = testAdminClient();
    const email = `partner-directory-${randomUUID()}@example.test`;
    const password = `Z9v!${randomUUID()}`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(createError).toBeNull();
    expect(created.user).not.toBeNull();
    if (!created.user) return;
    fixtureUserId = created.user.id;

    const { error: roleError } = await admin
      .from("profiles")
      .update({ role: "owner" })
      .eq("id", fixtureUserId);
    expect(roleError).toBeNull();

    const client = testAdminClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    expect(signInError).toBeNull();
    const { data: factor, error: enrollError } = await client.auth.mfa.enroll({
      factorType: "totp",
    });
    expect(enrollError).toBeNull();
    expect(factor?.totp?.secret).toBeTruthy();
    if (!factor?.totp?.secret) return;
    const windowRemaining = 30_000 - (Date.now() % 30_000);
    if (windowRemaining < 3_000) {
      await new Promise((resolve) => setTimeout(resolve, windowRemaining + 100));
    }
    const { error: verifyError } = await client.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: totp(factor.totp.secret),
    });
    expect(verifyError).toBeNull();
    slot.client = client;
  });

  afterAll(async () => {
    if (fixtureUserId) {
      const { error } = await admin.auth.admin.deleteUser(fixtureUserId);
      expect(error).toBeNull();
    }
  });

  it("shows the seeded company and counts its two referred claims", async () => {
    const probe = await (slot.client as ReturnType<typeof testAdminClient>)
      .from("partner_companies")
      .select("id");
    expect(probe.error).toBeNull();
    expect(probe.data).toContainEqual({
      id: "10000000-0000-4000-a000-000000000001",
    });
    const page = await loadPartnerPage(null, 0, 49);
    const company = page.companies.find(
      (item) => item.id === "10000000-0000-4000-a000-000000000001",
    );

    expect(company).toMatchObject({ name: "Summit Exteriors LLC", claimCount: 2 });
    expect(company?.repCount).toBeGreaterThan(0);
  });
});
