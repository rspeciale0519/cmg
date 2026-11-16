import { test, expect } from "@playwright/test";
import {
  SEED,
  attachDiagnostics,
  captureEvidence,
  expectNoFatalConsole,
} from "./_helpers.mjs";

test.describe("customer portal", () => {
  test("customer signs in and opens the seeded claim documents tab", async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to your claim." })).toBeVisible();
    await page.locator("#field-email").fill(SEED.customer);
    await page.locator("#field-password").fill(SEED.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(new RegExp(`/portal/claims/${SEED.customerClaimId}`), {
      timeout: 20_000,
    });
    await expect(page.getByRole("navigation", { name: "Client portal" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Claim sections" })).toBeVisible();
    await expect(page.getByText(SEED.customerClaimRef)).toBeVisible();
    await expect(page.getByRole("heading", { name: "1420 Sandhill Crane Dr" })).toBeVisible();

    await page.getByRole("navigation", { name: "Claim sections" }).getByRole("link", { name: "Documents" }).click();
    await expect(page).toHaveURL(/\/documents$/);
    await expect(page.getByLabel("What is this?")).toBeVisible();
    await expect(page.getByLabel("Choose files")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send to CMG" })).toBeVisible();

    await captureEvidence(page, "customer-portal", {
      consoleLines: diag.consoleLines,
      networkErrors: diag.networkErrors,
    });
    await expectNoFatalConsole(diag.consoleLines);
  });
});
