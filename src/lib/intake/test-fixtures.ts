import { spawnSync } from "node:child_process";
import { intakeSchema } from "@/lib/validators/intake";

const LOCAL_STACKS = {
  CMGPA: { apiPort: "15421", dbPort: "15422", dbContainer: "supabase_db_CMGPA" },
  CMGPA_private_upload_disposable: {
    apiPort: "15521", dbPort: "15522", dbContainer: "supabase_db_CMGPA_private_upload_disposable",
  },
} as const;

export function localIntakeFixtureStack() {
  const name = process.env.CMG_TEST_STACK ?? "CMGPA";
  if (!(name in LOCAL_STACKS)) throw new Error("Unknown local CMG test stack.");
  return LOCAL_STACKS[name as keyof typeof LOCAL_STACKS];
}

export function intakeFixtureInput() {
  return intakeSchema.parse({
    firstName: "Upload", lastName: "Fixture", email: "intake-upload@example.invalid",
    phone: "407-555-0119", initials: "uf", hasSecondPolicyholder: "no",
    carrier: "Fixture Carrier", policyNumber: "UPLOAD-FIXTURE", carrierTenure: "three_plus_years",
    priorRoofClaim: "no", lorContractType: "non_emergency", lossDate: "2026-07-14",
    lossTime: "16:30", cause: "wind_hail", description: "Local upload fixture for roof damage.",
    street: "100 Fixture Way", city: "Orlando", state: "Florida", zip: "32801",
    requestedAdjuster: "austin-graham", consent: "on", turnstileToken: "fixture-token",
  });
}

/** The production service role cannot erase capability history. Disposable
 * local tests remove only their captured UUID rows, after Storage API cleanup.
 * Docker is already required by the local Supabase and CI database jobs. */
export function removeLocalIntakeFixtureRecords(ids: readonly string[]): void {
  if (ids.length === 0) return;
  if (ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))) {
    throw new Error("An exact intake fixture ID is required.");
  }
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const stack = localIntakeFixtureStack();
  if (endpoint.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(endpoint.hostname) ||
      endpoint.port !== stack.apiPort || endpoint.username || endpoint.password ||
      endpoint.pathname !== "/" || endpoint.search || endpoint.hash) {
    throw new Error("Intake fixture cleanup requires the local CMG API.");
  }
  const port = spawnSync("docker", ["inspect", "--format",
    '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', stack.dbContainer],
  { encoding: "utf8", timeout: 10_000, windowsHide: true });
  if (port.status !== 0 || port.stdout.trim() !== stack.dbPort) {
    throw new Error("The local CMG database container could not be confirmed.");
  }
  const literals = ids.map((id) => `'${id}'::uuid`).join(",");
  const result = spawnSync("docker", ["exec", "-i", stack.dbContainer, "psql",
    "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], {
    input: `begin; delete from public.intake_upload_files where session_id in (${literals});
      delete from public.intake_upload_sessions where id in (${literals}); commit;`,
    encoding: "utf8", timeout: 10_000, windowsHide: true,
  });
  if (result.status !== 0) throw new Error("Local intake fixture cleanup failed; records remain for review.");
}
