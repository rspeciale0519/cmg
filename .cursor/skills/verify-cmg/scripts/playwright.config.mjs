import { defineConfig, devices } from "@playwright/test";

const evidenceDir = process.env.VERIFY_EVIDENCE_DIR;
if (!evidenceDir) {
  throw new Error("VERIFY_EVIDENCE_DIR is required");
}

export default defineConfig({
  testDir: "./journeys",
  testMatch: /.*\.spec\.mjs/,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: `${evidenceDir}/playwright.json` }],
  ],
  use: {
    baseURL: process.env.VERIFY_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
