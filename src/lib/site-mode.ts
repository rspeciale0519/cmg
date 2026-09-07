export type SiteMode = "simple" | "platform";

export const PLATFORM_DISABLED_PATH = "/platform-disabled";

const PLATFORM_PATH_PREFIXES = [
  "/login",
  "/mfa",
  "/invite",
  "/admin",
  "/portal",
  "/partner",
] as const;

export const PUBLIC_FORM_TEMPLATES = [
  "intake_staff_alert",
  "intake_confirmation",
  "lead_staff_alert",
  "lead_auto_reply",
] as const;

/**
 * Simple mode is the safe default. A missing or invalid value must never open
 * the authenticated platform by accident.
 */
export function siteMode(value = process.env.SITE_MODE): SiteMode {
  return value?.trim().toLowerCase() === "platform" ? "platform" : "simple";
}

export function isSimpleMode(value = process.env.SITE_MODE): boolean {
  return siteMode(value) === "simple";
}

export function isPlatformPath(pathname: string): boolean {
  return PLATFORM_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
