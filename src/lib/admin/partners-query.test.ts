// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const slot = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => slot.client }));

import { loadPartnerPage } from "./partners";

type QueryResult = { data: unknown[] | null; count: number | null; error: { message: string } | null };

function query(result: QueryResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

describe("partner page query results", () => {
  beforeEach(() => { slot.client = null; });

  function setup(list: QueryResult, active: QueryResult) {
    const listQuery = query(list);
    const activeQuery = query(active);
    slot.client = { from: vi.fn().mockReturnValueOnce(listQuery).mockReturnValueOnce(activeQuery) };
    return { listQuery, activeQuery };
  }

  it("keeps database totals when a later page contains fewer companies", async () => {
    const row = { id: "company", name: "Test", status: "active", contact_name: null,
      contact_email: null, contact_phone: null, created_at: "2026-10-05", reps: [{ count: 3 }], claims: [{ count: 7 }] };
    const { listQuery, activeQuery } = setup({ data: [row], count: 51, error: null }, { data: null, count: 40, error: null });
    const page = await loadPartnerPage(null, 50, 99);
    expect(listQuery.range).toHaveBeenCalledWith(50, 99);
    expect(listQuery.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(activeQuery.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(page).toMatchObject({ total: 51, activeTotal: 40, companies: [{ repCount: 3, claimCount: 7 }] });
  });

  it.each(["active", "inactive"] as const)("applies the %s filter to both counts", async (status) => {
    const { listQuery, activeQuery } = setup({ data: [], count: 0, error: null }, { data: null, count: 0, error: null });
    expect(await loadPartnerPage(status, 0, 49)).toEqual({ companies: [], total: 0, activeTotal: 0 });
    expect(listQuery.eq).toHaveBeenCalledWith("status", status);
    expect(activeQuery.eq.mock.calls).toEqual([["status", "active"], ["status", status]]);
  });

  it.each(["list", "active"])("rejects a failed %s query instead of showing zero", async (failed) => {
    setup({ data: [], count: 4, error: failed === "list" ? { message: "private database detail" } : null },
      { data: null, count: 3, error: failed === "active" ? { message: "private database detail" } : null });
    await expect(loadPartnerPage(null, 0, 49)).rejects.toThrow("Partner directory could not be loaded.");
  });

  it.each(["list", "active"])("rejects a missing exact %s count", async (missing) => {
    setup({ data: [], count: missing === "list" ? null : 4, error: null },
      { data: null, count: missing === "active" ? null : 3, error: null });
    await expect(loadPartnerPage(null, 0, 49)).rejects.toThrow("Partner directory could not be loaded.");
  });
});
