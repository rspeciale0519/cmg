// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const vitestCli = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const liveTest = "src/lib/esign/pandadoc-draft.live.test.ts";
const credentials = {
  PANDADOC_API_KEY: "discovery-test-key",
  PANDADOC_DRAFT_TEST_EMAIL: "discovery@example.invalid",
};
const credentialsFile = Object.entries(credentials)
  .map(([name, value]) => `${name}=${value}`)
  .join("\n");

async function discoverLiveDraft(options: {
  env?: Record<string, string>;
  envFile?: string;
  envDirectory?: boolean;
} = {}) {
  const scratchRoot = path.resolve(tmpdir());
  const directory = await mkdtemp(path.join(scratchRoot, "cmg-pandadoc-discovery-"));
  try {
    if (options.envFile !== undefined) {
      await writeFile(path.join(directory, ".env.local"), options.envFile);
    }
    if (options.envDirectory) {
      await mkdir(path.join(directory, ".env.local"));
    }

    const setupFile = path.join(directory, "setup.mjs");
    await writeFile(setupFile, `
      if (process.cwd() !== ${JSON.stringify(directory)}) {
        throw new Error("Discovery must use its temporary working directory");
      }
      globalThis.fetch = () => {
        throw new Error("Network calls are forbidden during discovery");
      };
    `);
    const configFile = path.join(directory, "vitest.config.mjs");
    await writeFile(configFile, `export default ${JSON.stringify({
      root: projectRoot,
      envDir: directory,
      cacheDir: path.join(directory, ".vite"),
      test: {
        environment: "node",
        pool: "forks",
        include: [liveTest],
        setupFiles: [setupFile],
        maxWorkers: 1,
      },
      resolve: { alias: { "@": path.join(projectRoot, "src") } },
    })};`);

    const env = { ...process.env };
    for (const name of Object.keys(env)) {
      if (name.toUpperCase().startsWith("PANDADOC_")) delete env[name];
    }
    const result = spawnSync(process.execPath, [
      vitestCli, "list", "--config", configFile, "--json", "--no-color",
    ], {
      cwd: directory,
      env: { ...env, ...options.env },
      encoding: "utf8",
      timeout: 20_000,
      windowsHide: true,
    });
    expect(result.error, result.stderr).toBeUndefined();
    return result;
  } finally {
    if (path.dirname(directory) !== scratchRoot ||
      !path.basename(directory).startsWith("cmg-pandadoc-discovery-")) {
      throw new Error("Refusing to remove a path outside the discovery scratch folder");
    }
    await rm(directory, { recursive: true, force: true });
  }
}

function collectedTests(result: Awaited<ReturnType<typeof discoverLiveDraft>>) {
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).not.toMatch(/(?:Error|FAIL|ENOENT)/);
  return JSON.parse(result.stdout) as { name: string; file: string }[];
}

describe("PandaDoc live draft discovery", () => {
  it("discovers safely without .env.local or a live opt-in", async () => {
    expect(collectedTests(await discoverLiveDraft())).toEqual([]);
  }, 30_000);

  it("does not read the environment path without an explicit opt-in", async () => {
    expect(collectedTests(await discoverLiveDraft({ envDirectory: true }))).toEqual([]);
  }, 30_000);

  it.each([undefined, "0", "true"])(
    "does not accept .env.local opt-in when the shell flag is %s",
    async (flag) => {
      const result = await discoverLiveDraft({
        env: flag === undefined ? {} : { PANDADOC_LIVE_DRAFT_TEST: flag },
        envFile: `PANDADOC_LIVE_DRAFT_TEST=1\n${credentialsFile}`,
      });
      expect(collectedTests(result)).toEqual([]);
    },
    30_000,
  );

  it("accepts explicit shell credentials without .env.local", async () => {
    const result = await discoverLiveDraft({
      env: { PANDADOC_LIVE_DRAFT_TEST: "1", ...credentials },
    });
    expect(collectedTests(result)).toEqual([
      expect.objectContaining({ name: expect.stringContaining("creates a draft") }),
    ]);
  }, 30_000);

  it("loads optional credentials after an explicit shell opt-in", async () => {
    const result = await discoverLiveDraft({
      env: { PANDADOC_LIVE_DRAFT_TEST: "1" },
      envFile: credentialsFile,
    });
    expect(collectedTests(result)).toEqual([
      expect.objectContaining({ name: expect.stringContaining("creates a draft") }),
    ]);
  }, 30_000);

  it.each(Object.keys(credentials))("requires %s after loading optional credentials", async (name) => {
    const result = await discoverLiveDraft({
      env: { PANDADOC_LIVE_DRAFT_TEST: "1" },
      envFile: Object.entries(credentials)
        .filter(([key]) => key !== name)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    });
    expect(collectedTests(result)).toEqual([]);
  }, 30_000);

  it("does not suppress an unreadable environment path", async () => {
    const result = await discoverLiveDraft({
      env: { PANDADOC_LIVE_DRAFT_TEST: "1", ...credentials },
      envDirectory: true,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(".env.local");
    expect(result.stderr).not.toMatch(/code: ['"]ENOENT['"]/);
  }, 30_000);
});
