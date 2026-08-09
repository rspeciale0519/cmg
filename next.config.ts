import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "*": ["./design/**", "./temp/**"],
  },
};

export default nextConfig;
