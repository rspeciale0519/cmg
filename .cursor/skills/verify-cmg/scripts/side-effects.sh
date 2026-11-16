#!/usr/bin/env bash
# Read rows written by a public form (leads, claims, notifications_outbox).
# Usage: side-effects.sh <email>
# Writes JSON to stdout. Never prints service-role keys.

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

EMAIL="${1:?usage: side-effects.sh <email>}"

load_supabase_env || fail "supabase status -o env failed"

node --input-type=module -e '
const email = process.argv[1];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const headers = {
  apikey: key,
  Authorization: "Bearer " + key,
  Accept: "application/json",
};
async function rows(path) {
  const res = await fetch(url + path, { headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    return { error: res.status, body };
  }
  return body;
}
const leads = await rows("/rest/v1/leads?email=eq." + encodeURIComponent(email) + "&select=id,name,phone,email,status,created_at&order=created_at.desc");
const claims = await rows("/rest/v1/claims?select=id,claim_ref,status,property_street,created_at&order=created_at.desc&limit=5");
const outbox = await rows("/rest/v1/notifications_outbox?or=(recipient_email.eq." + encodeURIComponent(email) + ",template.in.(lead_staff_alert,lead_auto_reply,intake_staff_alert,intake_confirmation))&select=id,recipient_email,template,status,attempts,created_at&order=created_at.desc&limit=20");
process.stdout.write(JSON.stringify({ email, leads, claims, outbox }, null, 2) + "\n");
' "$EMAIL"
