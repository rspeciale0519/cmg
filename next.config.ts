import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
