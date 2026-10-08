// @vitest-environment node
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { Linter, type ESLint } from "eslint";
import { afterAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { getRootDirs } = require("@next/eslint-plugin-next/dist/utils/get-root-dirs.js") as {
  getRootDirs(context: { cwd: string; settings: { next?: { rootDir?: string | string[] } } }): string[];
};
const fixture = mkdtempSync(join(tmpdir(), "cmg-eslint-glob-"));
for (const name of ["app-one", "app-two"]) mkdirSync(join(fixture, name, "pages"), { recursive: true });
writeFileSync(join(fixture, "app-one", "pages", "entry.jsx"), "export default function Page() { return null; }");
writeFileSync(join(fixture, "app-file"), "not a directory");
afterAll(() => rmSync(fixture, { recursive: true, force: true }));

function roots(rootDir?: string | string[]) {
  return getRootDirs({ cwd: fixture, settings: { next: { rootDir } } })
    .map((path) => resolve(path).replace(/\\/g, "/"));
}
const normalized = fixture.replace(/\\/g, "/");

describe("Next.js lint dependency compatibility", () => {
  it("refuses an unreviewed glob contract", () => {
    const pluginRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
    const { globSync } = pluginRequire("fast-glob") as { globSync(pattern: unknown, options: unknown): string[] };
    expect(() => globSync("*", { onlyDirectories: false })).toThrow(TypeError);
    expect(() => globSync(["*"], { onlyDirectories: true })).toThrow(TypeError);
  });

  it("keeps the working directory when no root glob is configured", () => {
    expect(roots()).toEqual([normalized]);
  });

  it("finds only directories for wildcards, brace patterns, and root arrays", () => {
    const expected = ["app-one", "app-two"].map((name) => `${normalized}/${name}`).sort();
    expect(roots(`${normalized}/app-*`).sort()).toEqual(expected);
    expect(roots(`${normalized}/app-{one,two}`).sort()).toEqual(expected);
    expect(roots([join(fixture, "app-one"), join(fixture, "app-two")]).sort()).toEqual(expected);
    expect(roots(`${normalized}/missing-*`)).toEqual([]);
    expect(roots(`${relative(process.cwd(), fixture)}/app-*`).sort()).toEqual(expected);
  });

  it("keeps the Next.js navigation rule active for globbed root directories", () => {
    const plugin = require("@next/eslint-plugin-next") as ESLint.Plugin;
    const messages = new Linter().verify('const link = <a href="/entry">Entry</a>;', {
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "@next/next": plugin },
      settings: { next: { rootDir: `${normalized}/app-*` } },
      rules: { "@next/next/no-html-link-for-pages": "error" },
    });
    expect(messages.some((message) => message.ruleId === "@next/next/no-html-link-for-pages" && message.severity === 2)).toBe(true);
  }, 15_000);
});