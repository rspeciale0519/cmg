import { expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const JOURNEYS_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = path.dirname(JOURNEYS_DIR);
const TOTP_BIN = path.join(SCRIPT_DIR, "totp.mjs");

export const SEED = {
  password: "CmgDev!2026",
  owner: "owner@cmg.test",
  adjuster: "adjuster@cmg.test",
  assistant: "assistant@cmg.test",
  customer: "customer@cmg.test",
  partner: "partner@cmg.test",
  customerClaimId: "20000000-0000-4000-a000-000000000001",
  customerClaimRef: "CMG-2026-0001",
  partnerCompany: "Summit Exteriors LLC",
};

export function evidenceDir() {
  const dir = process.env.VERIFY_EVIDENCE_DIR;
  if (!dir) throw new Error("VERIFY_EVIDENCE_DIR is required");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function attachDiagnostics(page) {
  const consoleLines = [];
  const networkErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleLines.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    consoleLines.push({ type: "pageerror", text: String(err) });
  });
  page.on("response", (res) => {
    const status = res.status();
    if (status >= 400) {
      networkErrors.push({ status, url: res.url() });
    }
  });
  page.on("requestfailed", (req) => {
    networkErrors.push({
      status: "failed",
      url: req.url(),
      error: req.failure()?.errorText,
    });
  });
  return { consoleLines, networkErrors };
}

export async function waitForTurnstile(page) {
  await page.waitForFunction(() => {
    const input = document.querySelector('input[name="cf-turnstile-response"]');
    return Boolean(input && input.value && input.value.length > 10);
  }, { timeout: 45_000 });
}

export async function captureEvidence(page, stem, extras = {}) {
  const dir = evidenceDir();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: path.join(dir, `${stem}-desktop.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(dir, `${stem}-mobile-390.png`), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  const payload = {
    capturedAt: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    ...extras,
  };
  fs.writeFileSync(path.join(dir, `${stem}-meta.json`), `${JSON.stringify(payload, null, 2)}\n`);
  if (extras.consoleLines) {
    fs.writeFileSync(path.join(dir, "console.json"), `${JSON.stringify(extras.consoleLines, null, 2)}\n`);
  }
  if (extras.networkErrors) {
    fs.writeFileSync(path.join(dir, "network-errors.json"), `${JSON.stringify(extras.networkErrors, null, 2)}\n`);
  }
}

export function totp(secret) {
  return execFileSync(process.execPath, [TOTP_BIN, secret], { encoding: "utf8" }).trim();
}

export async function expectNoFatalConsole(consoleLines) {
  const fatal = consoleLines.filter((line) =>
    /hydrat|chunkload|uncaught|TypeError|ReferenceError/i.test(line.text),
  );
  expect(fatal, `fatal console errors: ${JSON.stringify(fatal)}`).toEqual([]);
}

export function uniqueEmail(prefix) {
  const stamp = Date.now().toString(36);
  return `${prefix}-${stamp}@verify.cmg.test`;
}
