function localSupabaseSources(configuredUrl?: string): string {
  const sources = new Set(["http://127.0.0.1:15421", "ws://127.0.0.1:15421"]);
  if (configuredUrl) {
    try {
      const endpoint = new URL(configuredUrl);
      if (endpoint.protocol === "http:" && !endpoint.username && !endpoint.password &&
        ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)) {
        sources.add(endpoint.origin);
        sources.add(endpoint.origin.replace(/^http:/, "ws:"));
      }
    } catch {
      // Invalid configuration must not add sources to the existing policy.
    }
  }
  return " " + [...sources].join(" ");
}

export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
  upgradeInsecureRequests = true,
  configuredSupabaseUrl?: string,
): string {
  // The proxy disables upgrading only for a loopback application origin.
  // Local production builds need the same private Storage endpoint as dev.
  const localSupabase = development || !upgradeInsecureRequests
    ? localSupabaseSources(configuredSupabaseUrl)
    : "";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "media-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com${localSupabase}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    upgradeInsecureRequests ? "upgrade-insecure-requests" : null,
  ]
    .filter((directive): directive is string => directive !== null)
    .join("; ");
}
