import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

const STACK = "CMGPA_legal_airtable_disposable";
const CONTAINER = `supabase_db_${STACK}`;
const DOCKER = "C:/Program Files/Docker/Docker/resources/bin/docker.exe";
const LOCAL_DOCKER = "npipe:////./pipe/docker_engine";

function dockerEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", DOCKER_HOST: LOCAL_DOCKER };
  for (const [name, value] of Object.entries(process.env)) {
    if (["SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP"].includes(name.toUpperCase())) env[name] = value;
  }
  return env;
}

/** No Docker or environment-file access occurs until the explicit test opt-in. */
export function verifyConcurrencyTarget(): string {
  if (process.env.CMG_AIRTABLE_CONCURRENCY_TEST !== "1") throw new Error("Airtable concurrency testing is not enabled.");
  if (process.version !== "v22.22.2" || process.env.CMG_TEST_STACK !== STACK ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:15621" ||
      process.env.DOCKER_HOST !== LOCAL_DOCKER) throw new Error("The approved isolated test environment is required.");
  const confirmed = process.env.CMG_CONFIRMED_DB_CONTAINER_ID ?? "";
  if (!/^[a-f0-9]{64}$/.test(confirmed)) throw new Error("The confirmed disposable container ID is required.");
  const format = '{{json .Id}}|{{json .Name}}|{{json .State.Running}}|{{json .Config.Labels}}|{{json .NetworkSettings.Ports}}';
  const result = spawnSync(DOCKER, ["inspect", "--format", format, CONTAINER], {
    env: dockerEnvironment(), encoding: "utf8", windowsHide: true, timeout: 10_000,
  });
  if (result.error || result.status !== 0) throw new Error("The disposable database identity could not be checked.");
  const [id, name, running, labels, ports] = z.tuple([
    z.string(), z.string(), z.boolean(), z.record(z.string(), z.string()),
    z.record(z.string(), z.array(z.object({ HostIp: z.string(), HostPort: z.string() })).nullable()),
  ]).parse(result.stdout.trim().split("|").map(part => JSON.parse(part) as unknown));
  const bindings = ports["5432/tcp"];
  if (id !== confirmed || name !== `/${CONTAINER}` || !running ||
      labels["com.supabase.cli.project"] !== STACK || labels["com.docker.compose.project"] !== STACK ||
      !bindings?.length || bindings.some(binding => binding.HostPort !== "15622")) {
    throw new Error("The disposable database identity changed.");
  }
  return confirmed;
}

export class ConcurrentSqlSession {
  private readonly child: ChildProcessWithoutNullStreams;
  private output = "";
  private errors = "";
  private pending: { marker: string; resolve: (value: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private exited = false;

  constructor(confirmedId: string) {
    if (!/^[a-f0-9]{64}$/.test(confirmedId)) throw new Error("Invalid disposable container identity.");
    // Address the inspected immutable ID. A replacement with the same name cannot receive SQL.
    this.child = spawn(DOCKER, ["exec", "-i", confirmedId, "psql", "-X", "-q", "-A", "-t",
      "--set=ON_ERROR_STOP=1", "--set=VERBOSITY=sqlstate", "--username=postgres", "--dbname=postgres"], {
      env: dockerEnvironment(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.output += chunk;
      const pending = this.pending;
      if (!pending) return;
      const lines = this.output.split(/\r?\n/);
      const marker = lines.findIndex(line => line === pending.marker);
      if (marker < 0) return;
      clearTimeout(pending.timer);
      this.pending = null;
      this.output = lines.slice(marker + 1).join("\n");
      pending.resolve(lines.slice(0, marker).join("\n").trim());
    });
    this.child.stderr.on("data", (chunk: string) => { this.errors = (this.errors + chunk).slice(-8000); });
    this.child.on("error", () => this.fail("Disposable SQL process failed."));
    // Wait for drained stdout/stderr before classifying an expected SQL refusal.
    this.child.on("close", code => {
      this.exited = true;
      if (this.pending) {
        const state = this.errors.match(/ERROR:\s+([0-9A-Z]{5})(?:\s|$)/)?.[1];
        this.fail(state ? `SQLSTATE ${state}` : `Disposable SQL process stopped (${code ?? "signal"}).`);
      }
    });
  }

  private fail(message: string) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending.reject(new Error(message));
    this.pending = null;
  }

  query(sql: string): Promise<string> {
    if (this.exited || this.pending) return Promise.reject(new Error("The disposable SQL session is not ready."));
    const marker = `CMG_DONE_${randomUUID().replaceAll("-", "")}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail("The disposable SQL query exceeded its limit."), 20_000);
      this.pending = { marker, resolve, reject, timer };
      this.child.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }

  async close(): Promise<void> {
    if (this.exited) return;
    // Closing this test's psql input rolls back only its open transaction.
    this.child.stdin.end("\\q\n");
    const until = Date.now() + 20_000;
    while (!this.exited && Date.now() < until) await delay(50);
    if (!this.exited) throw new Error("The disposable SQL session did not close; retain it for review.");
  }
}

export async function waitForConnectionLock(observer: ConcurrentSqlSession, applicationName: string) {
  if (!/^cmg_airtable_[a-f0-9]{32}$/.test(applicationName)) throw new Error("Invalid synthetic application name.");
  const until = Date.now() + 10_000;
  do {
    const result = await observer.query(`select exists(select 1 from pg_stat_activity where application_name='${applicationName}' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0);`);
    if (result === "t") return;
    await delay(50);
  } while (Date.now() < until);
  throw new Error("The configuration request did not enter its expected lock wait.");
}
