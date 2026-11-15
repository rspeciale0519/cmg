// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const run = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawnSync: run }));
import { localIntakeFixtureStack, removeLocalIntakeFixtureRecords } from "./test-fixtures";

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
const id = "11111111-1111-4111-8111-111111111111";

describe("isolated legal and Airtable fixture guard", () => {
  it("uses only the exact new stack name, ports, and container", () => {
    vi.stubEnv("CMG_TEST_STACK", "CMGPA_legal_airtable_disposable");
    expect(localIntakeFixtureStack()).toEqual({ apiPort: "15621", dbPort: "15622", dbContainer: "supabase_db_CMGPA_legal_airtable_disposable" });
    vi.stubEnv("CMG_TEST_STACK", "CMGPA_legal_airtable_disposable_copy");
    expect(() => localIntakeFixtureStack()).toThrow("Unknown");
  });
  it.each(["https://hosted.supabase.co", "http://127.0.0.1:15421", "http://127.0.0.1:15521", "http://127.0.0.1:15621/other", "http://name:password@127.0.0.1:15621"])("refuses a nonmatching API %s before Docker access", (endpoint) => {
    vi.stubEnv("CMG_TEST_STACK", "CMGPA_legal_airtable_disposable");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", endpoint);
    expect(() => removeLocalIntakeFixtureRecords([id])).toThrow("requires the local");
    expect(run).not.toHaveBeenCalled();
  });
  it("refuses a mismatched container port before SQL", () => {
    vi.stubEnv("CMG_TEST_STACK", "CMGPA_legal_airtable_disposable");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:15621");
    run.mockReturnValue({ status: 0, stdout: "15422" });
    expect(() => removeLocalIntakeFixtureRecords([id])).toThrow("could not be confirmed");
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("limits the reviewed synthetic cleanup to recorded UUIDs in the exact new container", () => {
    vi.stubEnv("CMG_TEST_STACK", "CMGPA_legal_airtable_disposable");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:15621");
    run.mockReturnValueOnce({ status: 0, stdout: "15622" }).mockReturnValueOnce({ status: 0 });
    removeLocalIntakeFixtureRecords([id]);
    expect(run.mock.calls[1][1]).toContain("supabase_db_CMGPA_legal_airtable_disposable");
    expect(run.mock.calls[1][2].input).toContain(`where session_id in ('${id}'::uuid)`);
    expect(() => removeLocalIntakeFixtureRecords(["unsafe-id"])).toThrow("exact intake fixture ID");
    expect(run).toHaveBeenCalledTimes(2);
  });
});
