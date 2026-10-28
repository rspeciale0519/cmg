# Next.js ESLint glob adapter

Next.js ESLint plugin 16.4.3 uses `fast-glob` only for `globSync(pattern, { onlyDirectories: true })`.
That dependency brings the unpatched `braces` advisory GHSA-vfj7-8cjw-p6xm into development tooling.

The root manifest replaces only that plugin version's glob dependency with this private local package.
The `3.3.1+cmg.1` version identifies the CMG replacement; it is not the published upstream implementation.
This package supports only the reviewed Next.js call, not the full fast-glob API.
It uses pinned `tinyglobby` 0.2.17 without the vulnerable dependency chain.
It preserves static-directory matching and absolute-pattern results.
It keeps filesystem roots intact and removes other trailing directory slashes.
It rejects unsupported calls.
It does not change application dependencies, lint rules, or audit thresholds.

Absolute patterns start from their filesystem root so tinyglobby can select the static directory prefix.
Relative patterns with a literal static prefix move only leading `.` and `..` segments into the search directory.
Their results remain relative to the original working directory.
Relative patterns without that prefix keep their original call and matching behavior.
This includes parent-only paths, leading exclamations, leading extglobs, and bare globstars.
Relative patterns at a filesystem-root boundary also keep their original call.
This prevents outside-cwd patterns from scanning an unrelated common ancestor.
The adapter does not resolve dynamic glob segments itself.
Single exclusion patterns return no matches without a directory scan; `!(...)` remains an extglob.
Filesystem-root patterns use `.` from that root so a drive root does not become a drive-relative path.

This remains the narrow local-directory contract used by Next.js.
UNC network-share traversal is not verified or supported by this adapter.
The installed tinyglobby version can lose UNC root identity during its internal path joins.
Glob syntax, escaping, and symlink behavior otherwise remain controlled by tinyglobby.

Node.js 22.12 or later can load this module from the plugin's CommonJS code.
The project uses Node.js 22.

`src/lib/tooling/eslint-config.test.ts` checks directory identity, wildcards, brace patterns, root arrays, missing paths, and relative paths.
It also executes the Next.js navigation rule against a fixture page and tests refusal of unsupported calls.
`src/lib/tooling/eslint-glob-scope.test.ts` uses the installed adapter and real synthetic directory entries.
Its guarded directory reader rejects ancestor traversal before enumeration.
It checks absolute and relative matching, escaped literals, extglobs, exclusions, dot directories, and root identity.
The root-identity case uses a virtual empty directory to avoid reading the real filesystem root.
The separate full lint command checks the unchanged project configuration.

Review this override when updating Next.js.
Remove it when an upstream dependency fix passes audit and compatibility checks.
Do not extend it to other callers without reviewing their contract.

References:
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/SuperchupuDev/tinyglobby
- https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#overrides
- https://nodejs.org/docs/latest-v22.x/api/modules.html#loading-ecmascript-modules-using-require
