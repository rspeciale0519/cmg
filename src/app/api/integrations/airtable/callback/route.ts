import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { airtableConfig, airtableEnabled } from "@/lib/airtable/config";
import { finishOAuth } from "@/lib/airtable/oauth";

export async function GET(request: Request) {
  if(!airtableEnabled()) return new Response("Not found",{status:404});
  const session = await requireOwner();
  let config:ReturnType<typeof airtableConfig>;
  try { config=airtableConfig(); } catch { return new Response("Connection unavailable",{status:503,headers:{"Cache-Control":"no-store"}}); }
  const url = new URL(request.url);
  let destination = "/admin/partners?airtable=connection_failed";
  try {
    if (url.searchParams.has("error")) throw new Error("Authorization refused");
    const company = await finishOAuth(url.searchParams.get("state") ?? "", url.searchParams.get("code") ?? "", session.userId);
    destination = `/admin/partners/${company}/airtable?connected=1`;
  } catch { /* Do not expose callback codes, tokens, or provider text. */ }
  const response = NextResponse.redirect(new URL(destination, new URL(config.redirectUri).origin));
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
