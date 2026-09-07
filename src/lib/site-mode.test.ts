import { describe, expect, it, vi } from "vitest";
import {
  isPlatformPath,
  isSimpleMode,
  siteMode,
  PLATFORM_DISABLED_PATH,
} from "./site-mode";

describe("site mode", () => {
  it("uses simple mode for missing and invalid values", () => {
    vi.stubEnv("SITE_MODE", "");
    try {
      expect(siteMode(undefined)).toBe("simple");
      expect(siteMode("unknown")).toBe("simple");
      expect(isSimpleMode(" ")).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("accepts platform mode only when explicitly configured", () => {
    expect(siteMode("platform")).toBe("platform");
    expect(siteMode(" PLATFORM ")).toBe("platform");
    expect(isSimpleMode("platform")).toBe(false);
  });

  it("matches only disabled platform path prefixes", () => {
    expect(isPlatformPath("/admin")).toBe(true);
    expect(isPlatformPath("/portal/claims/one")).toBe(true);
    expect(isPlatformPath("/partnerish")).toBe(false);
    expect(isPlatformPath(PLATFORM_DISABLED_PATH)).toBe(false);
    expect(isPlatformPath("/file-a-claim")).toBe(false);
  });
});
