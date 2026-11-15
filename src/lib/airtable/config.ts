import "server-only";
import { siteMode } from "@/lib/site-mode";
export function airtableEnabled(): boolean { return siteMode() === "platform" && process.env.AIRTABLE_ENABLED === "true"; }
export function airtableConfig() {
  if (!airtableEnabled()) throw new Error("AIRTABLE_PAUSED");
  const clientId = process.env.AIRTABLE_CLIENT_ID?.trim();
  const clientSecret = process.env.AIRTABLE_CLIENT_SECRET?.trim();
  const key = process.env.AIRTABLE_TOKEN_ENCRYPTION_KEY?.trim();
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !key || !redirectUri) throw new Error("AIRTABLE_NOT_CONFIGURED");
  const url = new URL(redirectUri);
  if (url.protocol !== "https:" || url.pathname !== "/api/integrations/airtable/callback" || url.search || url.hash || url.username || url.password) throw new Error("AIRTABLE_REDIRECT_INVALID");
  return { clientId, clientSecret, key, redirectUri };
}
