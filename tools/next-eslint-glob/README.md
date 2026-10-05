# Next.js ESLint glob adapter

Next.js ESLint plugin 16.3.8 uses `fast-glob` only for `globSync(pattern, { onlyDirectories: true })`.
That dependency brings the unpatched `braces` advisory GHSA-vfj7-8cjw-p6xm into development tooling.

The root manifest replaces only that plugin version's glob dependency with this private local package.
The `3.3.1+cmg.1` version identifies the CMG replacement; it is not the published upstream implementation.
This package supports only the reviewed Next.js call, not the full fast-glob API.
It uses pinned `tinyglobby` 0.2.17 without the vulnerable dependency chain.
It preserves static-directory matching and absolute-pattern results.
It keeps filesystem roots intact and removes other trailing directory slashes.
It rejects unsupported calls.
It does not change application dependencies, lint rules, or audit thresholds.

Node.js 22.12 or later can load this module from the plugin's CommonJS code.
The project uses Node.js 22.

`src/lib/tooling/eslint-config.test.ts` checks directory identity, wildcards, brace patterns, root arrays, missing paths, and relative paths.
It also executes the Next.js navigation rule against a fixture page and tests refusal of unsupported calls.
The separate full lint command checks the unchanged project configuration.

Review this override when updating Next.js.
Remove it when an upstream dependency fix passes audit and compatibility checks.
Do not extend it to other callers without reviewing their contract.

References:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/SuperchupuDev/tinyglobby
- https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#overrides
- https://nodejs.org/docs/latest-v22.x/api/modules.html#loading-ecmascript-modules-using-require
