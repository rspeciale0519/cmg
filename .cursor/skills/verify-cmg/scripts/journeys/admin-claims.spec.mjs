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

async function signInOwnerToAdmin(page) {
  const statePath = path.join(RUN_DIR, "storage-owner.json");
  if (fs.existsSync(statePath)) {
    return false;
  }
  await page.goto("/login");
  await page.locator("#field-email").fill(SEED.owner);
  await page.locator("#field-password").fill(SEED.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/mfa/, { timeout: 20_000 });
  if (await page.getByRole("button", { name: "Set up authenticator" }).count()) {
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    await expect(page.getByText("Or enter this key by hand")).toBeVisible();
    const secret = (await page.locator("p.font-mono").innerText()).replace(/\s+/g, "");
    await page.locator("#field-code").fill(totp(secret));
    await page.getByRole("button", { name: "Verify and finish setup" }).click();
  } else {
    throw new Error(
      "Owner already has a TOTP factor and this harness does not hold the secret. Run launch.sh --reset on disposable data, then staff-login, then this journey.",
    );
  }
  await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
  fs.mkdirSync(RUN_DIR, { recursive: true });
  await page.context().storageState({ path: statePath });
  return true;
}

test.describe("admin claim management", () => {
  test.use({
    storageState: fs.existsSync(path.join(RUN_DIR, "storage-owner.json"))
      ? path.join(RUN_DIR, "storage-owner.json")
      : undefined,
  });

  test("workspace claims list shows seeded CMG-2026-0001", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await signInOwnerToAdmin(page);

    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "CMG claims desk" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Claims desk." })).toBeVisible();

    await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Claims" }).click();
    await expect(page).toHaveURL(/\/admin\/claims/);
    await expect(page.getByRole("heading", { name: "Claims." })).toBeVisible();
    await page.locator("#claim-search").fill(SEED.customerClaimRef);
    // Cards (xl:hidden) and the desktop table both render the same reference.
    await expect(
      page.getByText(SEED.customerClaimRef, { exact: true }).filter({ visible: true }),
    ).toHaveCount(1);

    await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Intake" }).click();
    await expect(page.getByRole("heading", { name: "Intake queue." })).toBeVisible();

    await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Leads" }).click();
    await expect(page.getByRole("heading", { name: "Leads." })).toBeVisible();

    await captureEvidence(page, "admin-claims", {
      consoleLines: diag.consoleLines,
      networkErrors: diag.networkErrors,
    });
    await expectNoFatalConsole(diag.consoleLines);
  });
});
