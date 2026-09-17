import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "archive/**",
      "design/**",
      "temp/**",
      "supabase/**",
      "out/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,

  /* ─────────────────────────────────────────────────────────────────────────
     `./lor-dispatch` is a mechanism, not an entry point.

     `src/lib/esign/lor-dispatch.ts` puts a homeowner's Letter of Representation
     out for signature and performs NO authorization of its own: no
     `requireStaff`, no `claimCapabilities`. The check lives one layer up in
     `src/lib/esign/send-lor.ts`, and `src/lib/esign/index.ts` deliberately
     re-exports only `sendLor` so that a server action reaching for "the LOR
     function" lands on the one that asks who is calling.

     Until now the only thing keeping it that way was a paragraph of prose in
     `index.ts`. A future action that imports the deep path directly gets the
     mechanism without the guard, and prose does not fail a build — so the rule
     is stated here, where it is checked. The exemptions are the two files that
     legitimately reach the mechanism: the wrapper that authorizes it, and the
     mechanism's own integration test.

     Both spellings are listed because both work: `./lor-dispatch` from a sibling
     inside `src/lib/esign`, and `@/lib/esign/lor-dispatch` from anywhere else.
     ───────────────────────────────────────────────────────────────────────── */
  {
    name: "cmg/lor-dispatch-is-not-a-public-entry-point",
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/lib/esign/send-lor.ts", "src/lib/esign/lor-dispatch.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "./lor-dispatch",
                "**/lor-dispatch",
                "@/lib/esign/lor-dispatch",
              ],
              message:
                "Import `sendLor` from `@/lib/esign` instead. `lor-dispatch` sends the Letter of Representation without checking who asked; `send-lor.ts` is the entry point that runs requireStaff() and claimCapabilities() first.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
