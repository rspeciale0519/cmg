// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ workspace: vi.fn(), rpc: vi.fn(), refresh: vi.fn(), token: vi.fn(), schedule: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/authz", () => ({ requireOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/airtable/queries", () => ({ loadClaimSharing: mocks.workspace, loadCompanyAirtable: vi.fn() }));
vi.mock("@/lib/airtable/oauth", () => ({ accessToken: mocks.token, beginOAuth: vi.fn() }));
vi.mock("@/lib/airtable/store", () => ({ scheduleAirtableDelivery: mocks.schedule }));
vi.mock("@/lib/airtable/config", () => ({ airtableEnabled: () => true, airtableConfig: () => ({ key: Buffer.alloc(32, 7).toString("base64") }) }));
import { sealSecret } from "@/lib/airtable/crypto";
import { saveAirtableClaim } from "./airtable";

const actor = "48000001-0000-4000-8000-000000000001";
const claim = "48000002-0000-4000-8000-000000000001";
const company = "48000003-0000-4000-8000-000000000001";
const connection = "48000004-0000-4000-8000-000000000001";
const record = "rec00000000000001";
const cells = { fld00000000000001: null };
const fetcher = vi.fn<typeof fetch>();
function form(expires = Date.now() + 60_000) {
  const data = new FormData();
  data.set("claimId", claim); data.set("revision", "0"); data.set("confirmed", "on"); data.set("enabled", "on");
  data.set("mode", ""); data.append("fields", "claim_ref");
  data.set("expectedConnectionId", "48000000-0000-4000-d000-000000000099"); data.set("expectedConfigRevision", "999");
  data.set("proof", sealSecret(JSON.stringify({ claimId: claim, recordId: record, connectionId: connection, revision: 2, expires, cells }),
    `record:${actor}`, Buffer.alloc(32, 7).toString("base64")));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal("fetch", fetcher);
  mocks.workspace.mockResolvedValue({ session: { userId: actor }, link: null, connection: {
    id: connection, company_id: company, config_revision: 2, enabled: true,
    base_id: "app00000000000001", table_id: "tbl00000000000001",
    mappings: [{ source: "claim_ref", fieldId: "fld00000000000001", fieldType: "singleLineText" }],
  } });
  mocks.token.mockResolvedValue("synthetic-only");
  mocks.rpc.mockResolvedValue({ error: null });
  fetcher.mockResolvedValue(Response.json({ records: [{ id: record, fields: {} }] }));
});
afterEach(() => vi.unstubAllGlobals());

describe("Airtable record proof at the final database save", () => {
  it("carries the sealed connection and version into the RPC, ignoring form replacements", async () => {
    expect((await saveAirtableClaim({ status: "idle" }, form())).status).toBe("success");
    expect(mocks.rpc).toHaveBeenCalledWith("configure_airtable_claim", {
      p_claim_id: claim, p_expected_revision: 0, p_record_id: record, p_enabled: true,
      p_override: { mode: "", fields: ["claim_ref"], baseline: cells, expectedConnectionId: connection, expectedConfigRevision: 2 },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps the old sealed version when company settings change during the provider await", async () => {
    let release!: (response: Response) => void;
    let entered!: () => void;
    const reading = new Promise<void>(resolve => { entered = resolve; });
    fetcher.mockImplementationOnce(() => { entered(); return new Promise(resolve => { release = resolve; }); });
    const saving = saveAirtableClaim({ status: "idle" }, form());
    await reading;
    // The guarded RPC sees a newer database version after the external read.
    mocks.rpc.mockResolvedValue({ error: { code: "40001", message: "Private configuration detail" } });
    release(Response.json({ records: [{ id: record, fields: {} }] }));
    const result = await saving;
    expect(result.status).toBe("error");
    expect(result.message).not.toContain("Private");
    expect(mocks.rpc).toHaveBeenCalledWith("configure_airtable_claim", expect.objectContaining({
      p_override: expect.objectContaining({ expectedConnectionId: connection, expectedConfigRevision: 2 }),
    }));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("rejects an expired sealed record check before provider or database access", async () => {
    expect((await saveAirtableClaim({ status: "idle" }, form(Date.now() - 1000))).status).toBe("error");
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
