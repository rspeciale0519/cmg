import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Parallel fork startup can stall on Windows before test collection.
    // Start one worker there, and bound memory use on other hosts.
    // Tests remain isolated, with all assertions and timeouts unchanged.
    pool: "forks",
    maxWorkers: process.platform === "win32" ? 1 : 4,
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
