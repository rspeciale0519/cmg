import type { NextConfig } from "next";

const SECURITY_HEADERS = [
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
  outputFileTracingIncludes: {
    "/*": ["./src/lib/esign/templates/*.pdf"],
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
