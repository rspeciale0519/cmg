import type { NextConfig } from "next";

/**
 * Spec §7.6, as a header set rather than a paragraph.
 *
 * Every source below is one this product actually talks to, and the list is
 * short on purpose: a CSP that permits everything the app might one day need is
 * a CSP that stops nothing. Where a directive names a host, the reason it is
 * named is written beside it.
 *
 * `'unsafe-inline'` on `style-src` is the one concession and it is not
 * negotiable away here: Next injects the critical-CSS `<style>` for every route
 * inline, and Tailwind's arbitrary values compile into it. A nonce would mean
 * rendering every page dynamically, which would cost the static marketing site
 * its prerendering. Scripts, which are what CSP is mainly for, take no such
 * concession — `script-src` is `'self'` plus Turnstile and nothing else.
 *
 * Dev adds `'unsafe-eval'` because React Refresh evaluates the modules it swaps.
 * It is gated on NODE_ENV so it cannot reach production, and that gate is the
 * whole reason this is a function rather than a constant.
 */
function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV === "development";

  /* Supabase is reached from the browser for auth token refresh and for the
     realtime socket. Wildcarded because the project ref is part of the
     hostname and differs per environment; locally it is 127.0.0.1:54321, which
     is why the loopback origins are here in dev only. */
  const supabase = "https://*.supabase.co wss://*.supabase.co";
  const localSupabase = dev ? " http://127.0.0.1:54321 ws://127.0.0.1:54321" : "";

  return [
    "default-src 'self'",
    `script-src 'self' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // The Turnstile widget renders in an iframe from this origin.
    "frame-src https://challenges.cloudflare.com",
    // Nothing here may be framed. Clickjacking on a claims desk means a staff
    // member advancing a status they cannot see.
    "frame-ancestors 'none'",
    // The hero videos are served from this origin; `blob:` is not needed.
    "media-src 'self'",
    // `data:` for the inlined SVG chevrons and favicons; `blob:` for the
    // object URLs the document preview creates from a fetched file.
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase} https://challenges.cloudflare.com${localSupabase}`,
    // No plugins, and no <base> rewriting where a form posts.
    "object-src 'none'",
    "base-uri 'self'",
    // Server Actions post to the same origin; nothing else should.
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  {
    /* Two years and preload, which is what the preload list requires. Vercel
       terminates TLS, so this is additive to the platform rather than the only
       thing insisting on HTTPS. */
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  /* Redundant with `frame-ancestors` for any modern browser, and kept for the
     ones that read only this. */
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    /* Nothing in this product uses any of them. Naming them explicitly denies
       them to anything embedded that might. */
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  /* A claim file is not something to open in another origin's process. */
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  outputFileTracingExcludes: {
    "*": ["./design/**", "./temp/**"],
  },
  experimental: {
    serverActions: {
      // Spec §4 routes every intake upload through a Server Action and allows
      // 10 files of 25 MiB. The default cap is 1 MB, which severed the request
      // at the transport with ERR_CONNECTION_RESET — before the action ran, so
      // the size check never got to refuse anything and the form simply sat
      // there. 256 MiB covers the documented maximum plus the text fields.
      bodySizeLimit: "256mb",
    },
  },
};

export default nextConfig;
