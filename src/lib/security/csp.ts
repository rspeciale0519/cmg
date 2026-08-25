export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
  upgradeInsecureRequests = true,
): string {
  const localSupabase = development
    ? " http://127.0.0.1:15421 ws://127.0.0.1:15421"
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
