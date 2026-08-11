import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    /* `forks`, and the reason it is not `threads` any more is worth writing down
       because this file previously said the opposite.

       The old note — "the repo path contains a space, which breaks the forks
       pool's worker bootstrap on Windows" — was true of the toolchain it was
       written against and is no longer true of this one. Re-checked on Vitest
       4.1.10 / Node 22.22.2 from this exact path: `vitest run --pool=forks`
       passes 373/373, four consecutive times.

       What replaced it is a worse failure, because it is silent about being one.
       `threads` intermittently aborts with `[vitest-pool]: Failed to start
       threads worker` — a review run saw eighteen of them in a single
       invocation, and the same suite under `--pool=forks` passed. That is
       `new Worker()` failing at the OS level rather than any test asserting
       anything, so it lands as a red gate that is not about the code, and it
       does not reproduce on demand: four consecutive `--pool=threads` runs pass
       here. A gate that fails only under memory pressure teaches people to
       re-run it, which is the habit that lets a real failure through.

       Thirty files each build a jsdom environment; threads share one process, so
       peak memory is one heap and worker spawn is what gives out first. Forks
       pay a process each and are, on this suite, also slightly faster
       (~25s vs ~31s wall). Both pools are verified against this path rather than
       assumed, which is the part the old comment got wrong. */
    pool: "forks",
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
