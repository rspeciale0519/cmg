import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { airtableConfig } from "./config";
import { openSecret, sealSecret } from "./crypto";

const SCOPES = ["data.records:read", "data.records:write", "schema.bases:read"];
const tokenSchema = z.object({ access_token: z.string().min(1).max(6000), refresh_token: z.string().min(1).max(6000),
  expires_in: z.number().int().positive(), scope: z.string() });
export type TokenPair = z.infer<typeof tokenSchema>;
const stateSchema = z.object({ verifier: z.string(), redirectUri: z.string() });
export async function requestTokens(parameters: Record<string, string>): Promise<TokenPair> {
  const config = airtableConfig();
  let response: Response;
  try { response = await fetch("https://airtable.com/oauth2/v1/token", {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64url")}` },
    body: new URLSearchParams(parameters),
  }); } catch { throw new Error("AIRTABLE_RECONNECT_REQUIRED"); }
  if (!response.ok) throw new Error("AIRTABLE_RECONNECT_REQUIRED");
  let body:unknown;
  try { body=await response.json(); } catch { throw new Error("AIRTABLE_RECONNECT_REQUIRED"); }
  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success || SCOPES.some(s => !parsed.data.scope.split(" ").includes(s))) throw new Error("AIRTABLE_RECONNECT_REQUIRED");
  return parsed.data;
}
export async function beginOAuth(companyId: string, ownerId: string): Promise<string> {
  const config = airtableConfig();
  const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
  const stateHash = createHash("sha256").update(state).digest("hex");
  const ciphertext = sealSecret(JSON.stringify({ verifier, redirectUri: config.redirectUri }), `state:${ownerId}`, config.key);
  const supabase = await createClient();
  const { error } = await supabase.rpc("begin_airtable_oauth", { p_company_id: companyId, p_state_hash: stateHash, p_ciphertext: ciphertext });
  if (error) throw new Error("AIRTABLE_SETUP_FAILED");
  const url = new URL("https://airtable.com/oauth2/v1/authorize");
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: SCOPES.join(" "),
    state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return url.toString();
}
export async function finishOAuth(state: string, code: string, ownerId: string): Promise<string> {
  if (!/^[\w-]{43}$/.test(state) || !code || code.length > 6000) throw new Error("AIRTABLE_CALLBACK_INVALID");
  const config = airtableConfig(); const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_airtable_oauth", { p_state_hash: createHash("sha256").update(state).digest("hex") });
  const saved = z.object({ companyId: z.uuid(), ciphertext: z.string() }).safeParse(data);
  if (error || !saved.success) throw new Error("AIRTABLE_CALLBACK_INVALID");
  const decoded = stateSchema.parse(JSON.parse(openSecret(saved.data.ciphertext, `state:${ownerId}`, config.key)));
  if (decoded.redirectUri !== config.redirectUri) throw new Error("AIRTABLE_CALLBACK_INVALID");
  const pair = await requestTokens({ grant_type: "authorization_code", code, redirect_uri: decoded.redirectUri, code_verifier: decoded.verifier });
  const admin = createAdminClient();
  const { error: stored } = await admin.rpc("store_airtable_tokens", { p_company_id: saved.data.companyId,
    p_ciphertext: sealSecret(JSON.stringify(pair), `tokens:${saved.data.companyId}`, config.key),
    p_expires_at: new Date(Date.now() + pair.expires_in * 1000).toISOString() });
  if (stored) throw new Error("AIRTABLE_SETUP_FAILED");
  return saved.data.companyId;
}
export async function accessToken(connectionId: string, companyId: string): Promise<string> {
  const config = airtableConfig(), admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_airtable_refresh", { p_connection_id: connectionId });
  const saved = z.object({ ciphertext: z.string(), refresh: z.boolean(), leaseToken: z.uuid().optional(), version: z.number().optional() }).safeParse(data);
  if (error || !saved.success) throw new Error("AIRTABLE_RECONNECT_REQUIRED");
  const pair = tokenSchema.parse(JSON.parse(openSecret(saved.data.ciphertext, `tokens:${companyId}`, config.key)));
  if (!saved.data.refresh) return pair.access_token;
  if (!saved.data.leaseToken || saved.data.version === undefined) throw new Error("AIRTABLE_RECONNECT_REQUIRED");
  try {
    const next = await requestTokens({ grant_type: "refresh_token", refresh_token: pair.refresh_token });
    const { data: stored, error: failed } = await admin.rpc("settle_airtable_refresh", {
      p_connection_id: connectionId, p_lease_token: saved.data.leaseToken, p_version: saved.data.version,
      p_ciphertext: sealSecret(JSON.stringify(next), `tokens:${companyId}`, config.key), p_expires_at: new Date(Date.now() + next.expires_in * 1000).toISOString(), p_ok: true,
    });
    if (failed || stored !== true) throw new Error("AIRTABLE_RECONNECT_REQUIRED");
    return next.access_token;
  } catch {
    await admin.rpc("settle_airtable_refresh", { p_connection_id: connectionId, p_lease_token: saved.data.leaseToken,
      p_version: saved.data.version, p_ciphertext: "", p_expires_at: new Date().toISOString(), p_ok: false });
    throw new Error("AIRTABLE_RECONNECT_REQUIRED");
  }
}
