import { describe, expect, it, vi } from "vitest";
import {
  deliverableTemplates,
  isAnyPrivateSurfaceOpen,
  isPathOpen,
  isPlatformPath,
  isSurfaceOpen,
  PLATFORM_DISABLED_PATH,
  PLATFORM_PATH_PREFIXES,
  PUBLIC_FORM_TEMPLATES,
  siteMode,
  STAFF_ALERT_TEMPLATES,
  type SiteMode,
} from "./site-mode";

/**
 * The contract this pins: **`SITE_MODE` fails closed, and every one of the six
 * private prefixes has one documented answer in each of the three modes.**
 *
 * Written as a matrix rather than as spot checks because the failure this file
 * exists to catch is a prefix that nobody thought about when a mode was added.
 * A new mode or a new prefix has to extend `EXPECTED` and cannot pass by
 * accident.
 */

/** prefix → the modes that open it. Every cell is asserted, in both directions. */
const EXPECTED: Record<string, readonly SiteMode[]> = {
  "/login": ["platform", "staff"],
  "/mfa": ["platform", "staff"],
  "/admin": ["platform", "staff"],
  "/invite": ["platform"],
  "/portal": ["platform"],
  "/partner": ["platform"],
};

const MODES: readonly SiteMode[] = ["simple", "staff", "platform"];

describe("siteMode — fails closed", () => {
  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["whitespace", "   "],
    ["unknown word", "unknown"],
    ["near miss", "staffing"],
    ["another near miss", "platforms"],
    ["truthy but meaningless", "true"],
    ["numeric", "1"],
    ["comma list", "staff,platform"],
    ["json", '{"mode":"platform"}'],
    ["path traversal", "../platform"],
    ["null string", "null"],
  ] as const)("resolves %s to simple", (_label, value) => {
    expect(siteMode(value)).toBe("simple");
  });

  it.each(["platform", "PLATFORM", " platform ", " PlAtFoRm\t"])(
    "accepts %j as platform",
    (value) => {
      expect(siteMode(value)).toBe("platform");
    },
  );

  it.each(["staff", "STAFF", " staff ", "\nStaff\n"])(
    "accepts %j as staff",
    (value) => {
      expect(siteMode(value)).toBe("staff");
    },
  );

  it("reads SITE_MODE from the environment when no value is passed", () => {
    vi.stubEnv("SITE_MODE", "staff");
    try {
      expect(siteMode()).toBe("staff");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("falls back to simple when the environment variable is unset", () => {
    vi.stubEnv("SITE_MODE", "");
    try {
      expect(siteMode()).toBe("simple");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("isPathOpen — the full six-prefix by three-mode matrix", () => {
  it("covers every prefix the module exports, so a new one cannot go untested", () => {
    expect([...PLATFORM_PATH_PREFIXES].sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  for (const mode of MODES) {
    for (const [prefix, openIn] of Object.entries(EXPECTED)) {
      const open = openIn.includes(mode);

      it(`${mode}: ${prefix} is ${open ? "open" : "closed"}`, () => {
        expect(isPathOpen(prefix, mode)).toBe(open);
        expect(isPathOpen(`${prefix}/deeper/path`, mode)).toBe(open);
        expect(isSurfaceOpen(prefix, mode)).toBe(open);
      });
    }

    it(`${mode}: leaves public paths alone`, () => {
      for (const path of [
        "/",
        "/about",
        "/file-a-claim",
        "/api/cron/outbox",
        "/api/pandadoc/webhook",
        PLATFORM_DISABLED_PATH,
      ]) {
        expect(isPathOpen(path, mode)).toBe(true);
      }
    });

    it(`${mode}: does not gate a path that merely starts with a prefix's characters`, () => {
      for (const path of ["/partnerish", "/logins", "/admins", "/portalside"]) {
        expect(isPathOpen(path, mode)).toBe(true);
        expect(isPlatformPath(path)).toBe(false);
      }
    });
  }

  it("never redirects /platform-disabled to itself, in any mode", () => {
    for (const mode of MODES) {
      expect(isPathOpen(PLATFORM_DISABLED_PATH, mode)).toBe(true);
    }
    expect(isPlatformPath(PLATFORM_DISABLED_PATH)).toBe(false);
  });

  it("treats an unknown SITE_MODE as simple, closing all six", () => {
    vi.stubEnv("SITE_MODE", "not-a-mode");
    try {
      for (const prefix of Object.keys(EXPECTED)) {
        expect(isPathOpen(prefix)).toBe(false);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("isPlatformPath — prefix membership, independent of mode", () => {
  it.each(Object.keys(EXPECTED))("matches %s and its children", (prefix) => {
    expect(isPlatformPath(prefix)).toBe(true);
    expect(isPlatformPath(`${prefix}/claims/one`)).toBe(true);
  });

  it("does not match public paths", () => {
    expect(isPlatformPath("/file-a-claim")).toBe(false);
    expect(isPlatformPath("/")).toBe(false);
  });
});

describe("isAnyPrivateSurfaceOpen", () => {
  it.each([
    ["simple", false],
    ["staff", true],
    ["platform", true],
  ] as const)("%s → %s", (mode, expected) => {
    expect(isAnyPrivateSurfaceOpen(mode)).toBe(expected);
  });
});

describe("deliverableTemplates", () => {
  it("permits only the four public-form templates in simple mode", () => {
    expect(deliverableTemplates("simple")).toEqual([...PUBLIC_FORM_TEMPLATES]);
  });

  it("adds the staff-inbox alerts in staff mode", () => {
    expect(deliverableTemplates("staff")).toEqual([
      ...PUBLIC_FORM_TEMPLATES,
      ...STAFF_ALERT_TEMPLATES,
    ]);
  });

  it("applies no filter at all in platform mode", () => {
    expect(deliverableTemplates("platform")).toBeUndefined();
  });

  /**
   * The portal-linked templates are the reason staff mode is not simply "every
   * template but `invite`". Each of these renders a button into `/portal` or
   * `/partner`, or tells the recipient to look in a portal — all closed in
   * staff mode, so delivering one would mail a dead link.
   */
  it.each([
    "invite",
    "claim_status_update",
    "settled_notice",
    "partner_status_update",
    "reply_posted",
    "lor_signed",
  ])("withholds %s in staff mode", (template) => {
    expect(deliverableTemplates("staff")).not.toContain(template);
  });

  it.each([...PUBLIC_FORM_TEMPLATES, ...STAFF_ALERT_TEMPLATES])(
    "permits %s in staff mode",
    (template) => {
      expect(deliverableTemplates("staff")).toContain(template);
    },
  );

  it.each([...STAFF_ALERT_TEMPLATES])(
    "still withholds %s in simple mode",
    (template) => {
      expect(deliverableTemplates("simple")).not.toContain(template);
    },
  );

  it("falls back to the simple-mode list for an unknown SITE_MODE", () => {
    vi.stubEnv("SITE_MODE", "whatever");
    try {
      expect(deliverableTemplates()).toEqual([...PUBLIC_FORM_TEMPLATES]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
