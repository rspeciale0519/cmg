// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const nativeFs = require("node:fs") as typeof import("node:fs");
const pluginRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
const { globSync } = pluginRequire("fast-glob") as {
  globSync(pattern: unknown, options: unknown): string[];
};
const { getRootDirs } = require("@next/eslint-plugin-next/dist/utils/get-root-dirs.js") as {
  getRootDirs(context: { cwd: string; settings: { next: { rootDir: string | string[] } } }): string[];
};
const fixture = mkdtempSync(path.join(tmpdir(), "cmg-eslint-scope-"));
const directories = ["", "app-one", "app-one/pages", "app-two", "app-two/pages", "escaped[dir]", ".dot", ".dot/app-one", "!literal"];
for (const directory of directories.slice(1)) mkdirSync(path.join(fixture, directory), { recursive: true });
writeFileSync(path.join(fixture, "app-file"), "not a directory");
const normalized = fixture.replace(/\\/g, "/");
const normalize = (value: string) => path.resolve(value).replace(/\\/g, "/");
const allowedDirectories = new Set(directories.map((directory) => normalize(path.join(fixture, directory))));

afterAll(() => rmSync(fixture, { recursive: true, force: true }));

// Keep the installed adapter, tinyglobby, and directory entries real. Block the
// ancestor read before enumeration, including when fdir suppresses its error.
function withGuardedReads<T>(action: () => T, options: { virtualEmptyDirectory?: string; noReads?: boolean } = {}): T {
  const original = nativeFs.readdirSync;
  const blocked: string[] = [];
  const reads: string[] = [];
  nativeFs.readdirSync = ((directory, ...args) => {
    const resolved = normalize(String(directory));
    reads.push(resolved);
    if (resolved === options.virtualEmptyDirectory) return [];
    if (!allowedDirectories.has(resolved)) {
      blocked.push(path.basename(resolved) || path.parse(resolved).root);
      throw new Error("Refused a directory read outside the synthetic fixture");
    }
    return Reflect.apply(original, nativeFs, [directory, ...args]);
  }) as typeof nativeFs.readdirSync;
  syncBuiltinESMExports();
  let result: T;
  try {
    result = action();
  } finally {
    nativeFs.readdirSync = original;
    syncBuiltinESMExports();
  }
  expect(blocked, "The glob must not enumerate a fixture ancestor").toEqual([]);
  if (options.noReads) expect(reads).toEqual([]);
  else expect(reads.length).toBeGreaterThan(0);
  return result;
}

function roots(pattern: string | string[]) {
  return getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir: pattern } } });
}

describe("Next.js glob traversal scope", () => {
  it.each([
    ["wildcard", `${normalized}/app-*`, ["app-one", "app-two"]],
    ["braces", `${normalized}/app-{one,two}`, ["app-one", "app-two"]],
    ["static directory", `${normalized}/app-one`, ["app-one"]],
    ["missing directory", `${normalized}/missing-*`, []],
    ["file", `${normalized}/app-file`, []],
  ])("limits absolute %s reads to the fixture", (_name, pattern, expected) => {
    const result = withGuardedReads(() => roots(pattern as string));
    expect(result.sort()).toEqual((expected as string[]).map((name) => `${normalized}/${name}`));
  });

  it("keeps root arrays on the real Next.js call path", () => {
    const result = withGuardedReads(() => roots([path.join(fixture, "app-one"), path.join(fixture, "app-two")]));
    expect(result.sort()).toEqual([`${normalized}/app-one`, `${normalized}/app-two`]);
  });

  it.each(["", "./"])("limits leading-parent relative reads with prefix '%s'", (prefix) => {
    const relativeFixture = path.relative(process.cwd(), fixture).replace(/\\/g, "/");
    const result = withGuardedReads(() => roots(`${prefix}${relativeFixture}/app-*`));
    expect(result.sort()).toEqual([`${relativeFixture}/app-one`, `${relativeFixture}/app-two`]);
  });

  it("preserves escaped literals and extglob negation", () => {
    const escaped = withGuardedReads(() => globSync(`${normalized}/escaped\\[dir\\]`, { onlyDirectories: true }));
    expect(escaped).toEqual([`${normalized}/escaped[dir]`]);
    const extglob = withGuardedReads(() => roots(`${normalized}/app-!(one)`));
    expect(extglob).toEqual([`${normalized}/app-two`]);
  });

  it("keeps a literal leading exclamation after moving parent segments", () => {
    const originalCwd = process.cwd();
    process.chdir(path.join(fixture, "app-one"));
    try {
      const result = withGuardedReads(() => roots("../!literal"));
      expect(result).toEqual(["../!literal"]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("keeps a leading negated extglob below its parent while preserving globstar root matches", () => {
    const originalCwd = process.cwd();
    process.chdir(path.join(fixture, "app-one"));
    try {
      const extglob = withGuardedReads(() => roots("../!(app-one)"));
      // tinyglobby's existing negated-extglob behavior includes dot directories.
      expect(extglob.sort()).toEqual(["../!literal", "../.dot", "../app-two", "../escaped[dir]"]);
      const globstar = withGuardedReads(() => roots("../**"));
      expect(globstar).toContain("..");
      expect(globstar).not.toContain(".");
      expect(globstar).toContain("../app-two");
      const parent = withGuardedReads(() => roots(".."));
      expect(parent).toEqual([".."]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("preserves explicit dot directories and parent segments after globs", () => {
    const absolute = withGuardedReads(() => roots(`${normalized}/.dot/app-*`));
    expect(absolute).toEqual([`${normalized}/.dot/app-one`]);
    const relativeFixture = path.relative(process.cwd(), fixture).replace(/\\/g, "/");
    const relative = withGuardedReads(() => roots(`${relativeFixture}/.dot/app-*`));
    expect(relative).toEqual([`${relativeFixture}/.dot/app-one`]);
    const dynamicParent = withGuardedReads(() => roots(`${relativeFixture}/app-*/../app-two`));
    expect(dynamicParent).toEqual([`${relativeFixture}/app-two`]);
  });

  it.each([`!${normalized}/app-*`, `!${path.relative(process.cwd(), fixture).replace(/\\/g, "/")}/app-*`])(
    "keeps a negative-only pattern empty without reading directories: %s",
    (pattern) => {
      const result = withGuardedReads(() => globSync(pattern, { onlyDirectories: true }), { noReads: true });
      expect(result).toEqual([]);
    },
  );

  it("preserves filesystem-root identity without enumerating the real root", () => {
    const root = path.parse(process.cwd()).root.replace(/\\/g, "/");
    const result = withGuardedReads(() => globSync(root, { onlyDirectories: true }), { virtualEmptyDirectory: normalize(root) });
    expect(result).toEqual([root]);
  });

  it("refuses extra options before any directory read", () => {
    expect(() => globSync(`${normalized}/app-*`, { onlyDirectories: true, cwd: fixture })).toThrow(TypeError);
  });
});
