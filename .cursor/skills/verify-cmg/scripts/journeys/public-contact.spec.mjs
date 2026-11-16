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

test.describe("simple-mode public contact submission", () => {
  test("home → contact → submit review request → lead + outbox rows", async ({ page }) => {
    const diag = attachDiagnostics(page);
    const email = uniqueEmail("contact");
    const name = "Verify Contact";
    const phone = "407-555-0199";
    const message = "Local verification of the public contact form on /contact.";

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Your insurer has an adjuster/i }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Contact" }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(
      page.getByRole("heading", { name: "Start your free claim review." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Request a free review" }),
    ).toBeVisible();

    await page.locator("#field-name").fill(name);
    await page.locator("#field-phone").fill(phone);
    await page.locator("#field-email").fill(email);
    await page.locator("#field-message").fill(message);

    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Request my free review" }).click();
    await expect(page.getByRole("heading", { name: "Request received." })).toBeVisible({
      timeout: 30_000,
    });

    await captureEvidence(page, "public-contact", {
      email,
      consoleLines: diag.consoleLines,
      networkErrors: diag.networkErrors.filter((row) =>
        !/turnstile|cloudflare|googleapis|\.mp4($|\?)/i.test(row.url ?? ""),
      ),
    });
    await expectNoFatalConsole(diag.consoleLines);

    const side = execFileSync("bash", [SIDE_EFFECTS, email], { encoding: "utf8" });
    fs.writeFileSync(path.join(evidenceDir(), "side-effects.json"), side);
    const parsed = JSON.parse(side);
    const leads = Array.isArray(parsed.leads) ? parsed.leads : [];
    const match = leads.find((row) => row.email === email);
    expect(match, `lead row for ${email} missing: ${side}`).toBeTruthy();
    expect(match.name).toBe(name);
    expect(match.phone).toBe(phone);
    expect(match.status).toBe("new");

    const outbox = Array.isArray(parsed.outbox) ? parsed.outbox : [];
    const staff = outbox.find(
      (row) => row.template === "lead_staff_alert" && row.payload?.email === email,
    );
    const reply = outbox.find(
      (row) => row.template === "lead_auto_reply" && row.recipient_email === email,
    );
    expect(staff, "lead_staff_alert outbox row missing").toBeTruthy();
    expect(reply, "lead_auto_reply outbox row missing").toBeTruthy();
    expect(["pending", "sending", "sent"]).toContain(staff.status);
    expect(["pending", "sending", "sent"]).toContain(reply.status);
  });
});
