import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  SEED,
  attachDiagnostics,
  captureEvidence,
  evidenceDir,
  expectNoFatalConsole,
  totp,
} from "./_helpers.mjs";

test.describe("staff login and AAL2", () => {
  test("owner signs in, enrolls TOTP on /mfa, reaches /admin", async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to your claim." })).toBeVisible();
    await page.locator("#field-email").fill(SEED.owner);
    await page.locator("#field-password").fill(SEED.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/mfa/, { timeout: 20_000 });
    const heading = page.getByRole("heading", { name: /two-step verification|Enter your code|Set up two-step verification/i });
    await expect(heading).toBeVisible();

    if (await page.getByRole("button", { name: "Set up authenticator" }).count()) {
      await page.getByRole("button", { name: "Set up authenticator" }).click();
      await expect(page.getByText("Or enter this key by hand")).toBeVisible();
      const secret = (await page.locator("p.font-mono").innerText()).replace(/\s+/g, "");
      expect(secret.length, "TOTP secret missing on enrollment screen").toBeGreaterThan(10);
      const code = totp(secret);
      await page.locator("#field-code").fill(code);
      await page.getByRole("button", { name: "Verify and finish setup" }).click();
    } else {
      test.info().annotations.push({
        type: "gotcha",
        description: "Seed has no TOTP. If this account already enrolled, the page asks for a live authenticator code this harness does not hold.",
      });
      throw new Error(
        "Staff account already has a verified TOTP factor and the seed does not store the secret. Re-reset the disposable database (`launch.sh --reset`) so enrollment is the first-run path, or complete /mfa with the enrolled authenticator.",
      );
    }

    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
    await expect(page.getByRole("link", { name: "CMG claims desk" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Claims desk." })).toBeVisible();

    const statePath = path.join(evidenceDir(), "..", "..", "run", "storage-owner.json");
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    await page.context().storageState({ path: statePath });

    await captureEvidence(page, "staff-login", {
      consoleLines: diag.consoleLines,
      networkErrors: diag.networkErrors,
    });
    await expectNoFatalConsole(diag.consoleLines);
  });
});
