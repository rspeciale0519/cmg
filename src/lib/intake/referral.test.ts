import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-app";
vi.mock("server-only", () => ({}));
import { resolveIntakeReferral } from "./referral";

const code = "40000000-0000-4000-a000-000000000001";
function client(result: { data: unknown; error: unknown }) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result) };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  return { admin: { from } as unknown as SupabaseClient<Database>, query, from };
}

describe("vendor intake links", () => {
  it.each([null, ""])("preserves direct intake for %s", async (value) => {
    const { admin, from } = client({ data: null, error: null });
    expect(await resolveIntakeReferral(admin, value)).toEqual({ ok: true, partner: null });
    expect(from).not.toHaveBeenCalled();
  });
  it.each(["vendor-name", "x".repeat(500), "40000000-0000-0000-a000-000000000001"])("rejects malformed codes", async (value) => {
    const { admin, from } = client({ data: null, error: null });
    expect(await resolveIntakeReferral(admin, value)).toEqual({ ok: false });
    expect(from).not.toHaveBeenCalled();
  });
  it("resolves only the exact code for an active vendor", async () => {
    const vendor = { id: "40000000-0000-4000-a000-000000000010", name: "Test Roofing" };
    const { admin, query } = client({ data: vendor, error: null });
    expect(await resolveIntakeReferral(admin, code)).toEqual({ ok: true, partner: vendor });
    expect(query.eq.mock.calls).toEqual([["intake_referral_code", code], ["status", "active"]]);
    expect(query.select).toHaveBeenCalledWith("id, name");
  });
  it.each([{ data: null, error: null }, { data: null, error: { message: "private database failure" } }])(
    "refuses missing, inactive, or unavailable mappings without disclosing details", async (result) => {
      expect(await resolveIntakeReferral(client(result).admin, code)).toEqual({ ok: false });
    },
  );
});
