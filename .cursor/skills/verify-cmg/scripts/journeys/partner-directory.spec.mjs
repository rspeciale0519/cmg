import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEED,
  attachDiagnostics,
  captureEvidence,
  expectNoFatalConsole,
  totp,
} from "./_helpers.mjs";

const RUN_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "run",
);

test.describe("partner directory — admin owner list", () => {
  test.use({
    storageState: fs.existsSync(path.join(RUN_DIR, "storage-owner.json"))
      ? path.join(RUN_DIR, "storage-owner.json")
      : undefined,
  });

  test("owner opens /admin/partners and sees Summit Exteriors LLC", async ({ page }) => {
    const diag = attachDiagnostics(page);
    if (!fs.existsSync(path.join(RUN_DIR, "storage-owner.json"))) {
      await page.goto("/login");
      await page.locator("#field-email").fill(SEED.owner);
      await page.locator("#field-password").fill(SEED.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/mfa/, { timeout: 20_000 });
      if (!(await page.getByRole("button", { name: "Set up authenticator" }).count())) {
        throw new Error(
          "Owner TOTP is already enrolled and the seed does not store the secret. Reset the disposable database and run staff-login first.",
        );
      }
      await page.getByRole("button", { name: "Set up authenticator" }).click();
      await expect(page.getByText("Or enter this key by hand")).toBeVisible();
      const secret = (await page.locator("p.font-mono").innerText()).replace(/\s+/g, "");
      await page.locator("#field-code").fill(totp(secret));
      await page.getByRole("button", { name: "Verify and finish setup" }).click();
      await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
    }

    await page.goto("/admin/partners");
    await expect(page.getByRole("heading", { name: "Partner companies." })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Filter companies" })).toBeVisible();
    await expect(page.getByText(SEED.partnerCompany)).toBeVisible();
    await expect(page.getByText("Add a company")).toBeVisible();

    await captureEvidence(page, "partner-directory-admin", {
      consoleLines: diag.consoleLines,
      networkErrors: diag.networkErrors,
    });
    await expectNoFatalConsole(diag.consoleLines);
  });
});

test.describe("partner portal — referred claims", () => {
  test("partner signs in and sees referred claims", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/login");
    await page.locator("#field-email").fill(SEED.partner);
    await page.locator("#field-password").fill(SEED.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/partner/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Claims you referred." })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Partner portal" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Refer a claim" })).toBeVisible();
    await expect(page.getByText(/CMG-2026-0001|CMG-2026-0002/)).toBeVisible();

    await captureEvidence(page, "partner-portal", {
      consoleLines: diag.consoleLines,
      networkErrors: diag.networkErrors,
    });
    await expectNoFatalConsole(diag.consoleLines);
  });
});
