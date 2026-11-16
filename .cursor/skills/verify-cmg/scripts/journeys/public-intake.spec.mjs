import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  attachDiagnostics,
  captureEvidence,
  evidenceDir,
  expectNoFatalConsole,
  uniqueEmail,
  waitForTurnstile,
} from "./_helpers.mjs";

const SIDE_EFFECTS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "side-effects.sh",
);

test.describe("simple-mode public claim intake", () => {
  test("file-a-claim → submit intake → Intake received + claim_ref", async ({ page }) => {
    const diag = attachDiagnostics(page);
    const email = uniqueEmail("intake");

    await page.goto("/file-a-claim");
    await expect(page.getByRole("heading", { name: "Letter of Representation." })).toBeVisible();
    await expect(page.getByRole("heading", { name: /01 — Homeowner/ })).toBeVisible();

    await page.locator("#field-firstName").fill("Verify");
    await page.locator("#field-lastName").fill("Intake");
    await page.locator("#field-email").fill(email);
    await page.locator("#field-phone").fill("407-555-0130");
    await page.locator("#field-initials").fill("VI");
    await page.locator('input[name="hasSecondPolicyholder"][value="no"]').click();
    await page.locator("#field-carrier").fill("Citizens Property Insurance");
    await page.locator("#field-policyNumber").fill("FL-VERIFY-0001");
    await page.locator("#field-carrierTenure").selectOption("three_plus_years");
    await page.locator('input[name="priorRoofClaim"][value="no"]').click();
    await page.locator('input[name="lorContractType"][value="non_emergency"]').click();
    await page.locator("#field-lossDate").fill("2026-06-15");
    await page.locator("#field-cause").selectOption("wind_hail");
    await page.locator("#field-description").fill("Wind and hail stripped shingles on the south slope.");
    await page.locator("#field-street").fill("100 Verification Way");
    await page.locator("#field-city").fill("Orlando");
    await page.locator("#field-zip").fill("32801");
    await page.locator("#field-requestedAdjuster").selectOption("austin-graham");
    await page.locator("#field-consent").check({ force: true });

    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Submit intake" }).click();
    await expect(page.getByRole("heading", { name: "Intake received." })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Your reference")).toBeVisible();
    const reference = (
      await page.locator("p", { hasText: "Your reference" }).locator("span").innerText()
    ).trim();
    expect(reference).toMatch(/^CMG-\d{4}-\d{4}$/);

    await captureEvidence(page, "public-intake", {
      email,
      consoleLines: diag.consoleLines,
      networkErrors: diag.networkErrors.filter((row) => !/turnstile|cloudflare/i.test(row.url ?? "")),
    });
    await expectNoFatalConsole(diag.consoleLines);

    const side = execFileSync("bash", [SIDE_EFFECTS, email], { encoding: "utf8" });
    fs.writeFileSync(path.join(evidenceDir(), "side-effects.json"), side);
    const parsed = JSON.parse(side);
    const claims = Array.isArray(parsed.claims) ? parsed.claims : [];
    const claim = claims.find((row) => row.claim_ref === reference);
    expect(claim, `claim ${reference} for ${email} missing: ${side}`).toBeTruthy();
    expect(claim.property_street).toBe("100 Verification Way");
    const outbox = Array.isArray(parsed.outbox) ? parsed.outbox : [];
    expect(
      outbox.some((row) => row.template === "intake_staff_alert" && row.payload?.email === email),
    ).toBeTruthy();
    expect(
      outbox.some((row) => row.template === "intake_confirmation" && row.recipient_email === email),
    ).toBeTruthy();
  });
});
