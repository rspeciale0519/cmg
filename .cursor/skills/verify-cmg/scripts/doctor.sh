#!/usr/bin/env bash
# Read-only check that the verification instance is worth driving.
# Usage: doctor.sh
# Checks: app up, right build, port ours, Supabase healthy, auth surface works.

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

FAILS=0
note() { echo "  $*"; }
pass() { echo "PASS  $*"; }
bad() { echo "FAIL  $*"; FAILS=$((FAILS + 1)); }

BASE="$(app_base_url)"
PORT="${DEFAULT_PORT}"
MODE="${DEFAULT_MODE}"
APP_PID=""
GIT_SHA_EXPECTED="$(git rev-parse HEAD)"

if [[ -f "$STARTED_JSON" ]]; then
  PORT="$(json_get "$STARTED_JSON" port 2>/dev/null || echo "$PORT")"
  MODE="$(json_get "$STARTED_JSON" siteMode 2>/dev/null || echo "$MODE")"
  APP_PID="$(json_get "$STARTED_JSON" appPid 2>/dev/null || true)"
  BASE="$(json_get "$STARTED_JSON" baseUrl 2>/dev/null || echo "$BASE")"
  SHA_RECORDED="$(json_get "$STARTED_JSON" gitSha 2>/dev/null || true)"
else
  SHA_RECORDED=""
  note "no started.json — checking whatever is on ${BASE} (launch.sh writes the pid/mode record)"
fi

echo "verify-cmg doctor  base=${BASE}  mode=${MODE}  sha=${GIT_SHA_EXPECTED:0:12}"

# --- app up (usable, not only a port) ---
HOME_BODY="$(mktemp)"
HOME_CODE="$(curl -fsS -o "$HOME_BODY" -w "%{http_code}" --max-time 15 "$BASE/" || echo "000")"
if [[ "$HOME_CODE" != "200" ]]; then
  bad "GET ${BASE}/ returned ${HOME_CODE}"
else
  if grep -q "Your insurer has an adjuster" "$HOME_BODY" \
    && grep -q "CMG Property Solutions" "$HOME_BODY"; then
    pass "homepage is the CMG marketing site (usable HTML, not an empty listener)"
  else
    bad "homepage 200 but missing expected CMG copy ('Your insurer has an adjuster')"
  fi
fi
rm -f "$HOME_BODY"

# --- right build ---
if [[ -n "$SHA_RECORDED" && "$SHA_RECORDED" != "$GIT_SHA_EXPECTED" ]]; then
  bad "started.json sha ${SHA_RECORDED:0:12} != HEAD ${GIT_SHA_EXPECTED:0:12}"
else
  pass "git HEAD ${GIT_SHA_EXPECTED:0:12} matches the launched record (or no record yet)"
fi
if [[ -f "$RUN_DIR/app.log" ]] && grep -q "Next.js" "$RUN_DIR/app.log"; then
  pass "app log names Next.js ($(grep -m1 "Next.js" "$RUN_DIR/app.log" | tr -s ' '))"
else
  note "app log does not yet mention Next.js (cold start?)"
fi

# --- port ours ---
if [[ -n "$APP_PID" ]]; then
  if kill -0 "$APP_PID" 2>/dev/null; then
    pass "recorded app pid ${APP_PID} is alive"
  else
    bad "recorded app pid ${APP_PID} is not running"
  fi
  LISTEN_OK=0
  if command -v ss >/dev/null 2>&1; then
    if ss -tlnp 2>/dev/null | grep -E ":${PORT}\\b" | grep -q .; then
      LISTEN_OK=1
    fi
  fi
  if [[ "$LISTEN_OK" -eq 0 ]]; then
    if curl -fsS --max-time 3 "$BASE/" >/dev/null 2>&1 && kill -0 "$APP_PID" 2>/dev/null; then
      pass "port ${PORT} answers and recorded pid ${APP_PID} is the process we started"
    else
      bad "could not confirm port ${PORT} belongs to pid ${APP_PID}"
    fi
  else
    pass "something is listening on port ${PORT}; recorded pid ${APP_PID} is ours"
  fi
else
  note "no recorded pid — cannot prove the listener is the process this skill started"
fi

# --- Supabase healthy ---
if load_supabase_env; then
  AUTH_HEALTH="$(curl -fsS --max-time 8 "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health" || true)"
  if [[ -n "$AUTH_HEALTH" ]]; then
    pass "Supabase GoTrue health at ${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health"
  else
    bad "Supabase auth health failed at ${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health"
  fi
  REST_CODE="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 8 \
    -H "apikey: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}" \
    -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}" \
    "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/" || echo "000")"
  if [[ "$REST_CODE" == "200" || "$REST_CODE" == "401" || "$REST_CODE" == "404" ]]; then
    pass "Supabase REST answered HTTP ${REST_CODE} on ${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/"
  else
    bad "Supabase REST unexpected HTTP ${REST_CODE}"
  fi
else
  bad "supabase status -o env failed (stack not running on this project?)"
fi

# --- vendor keys blank in the running process (unless live-vendors) ---
LIVE_VENDORS_REC=""
if [[ -f "$STARTED_JSON" ]]; then
  LIVE_VENDORS_REC="$(json_get "$STARTED_JSON" liveVendors 2>/dev/null || true)"
fi
if [[ "$LIVE_VENDORS_REC" == "true" || "$LIVE_VENDORS_REC" == "1" ]]; then
  note "live vendors opt-in recorded; not requiring blank Resend/PandaDoc/cron in /proc/environ"
elif [[ -z "$APP_PID" ]]; then
  bad "no recorded pid — cannot read /proc/<pid>/environ for vendor keys"
else
  PIDS_TO_SCAN=("$APP_PID")
  while read -r child; do
    [[ -n "$child" ]] || continue
    PIDS_TO_SCAN+=("$child")
  done < <(pgrep -P "$APP_PID" || true)
  VENDOR_FAIL=0
  while read -r key; do
    [[ -n "$key" ]] || continue
    for pid in "${PIDS_TO_SCAN[@]}"; do
      val="$(proc_env_value "$pid" "$key" || true)"
      if [[ -n "$val" ]]; then
        bad "pid ${pid} has ${key} set in /proc/environ (must be blank without --live-vendors)"
        VENDOR_FAIL=1
      fi
    done
  done < <(vendor_key_names)
  if [[ "$VENDOR_FAIL" -eq 0 ]]; then
    pass "vendor keys blank in /proc/${APP_PID}/environ and children (Resend/PandaDoc/cron)"
  fi
  SITE_KEY="$(proc_env_value "$APP_PID" NEXT_PUBLIC_TURNSTILE_SITE_KEY || true)"
  if [[ "$SITE_KEY" == "1x00000000000000000000AA" ]]; then
    pass "Turnstile site key is the Cloudflare always-pass test key"
  else
    bad "Turnstile site key is not the always-pass test key on pid ${APP_PID}"
  fi
fi

# --- auth works (mode-accurate, read-only: no sign-in) ---
# Follow redirects so we see the page a person lands on.
LOGIN_BODY="$(mktemp)"
LOGIN_CODE="$(curl -fsS -L -o "$LOGIN_BODY" -w "%{http_code}" --max-time 15 "${BASE}/login" || echo "000")"
case "$MODE" in
  simple)
    if grep -q "Online claim accounts are not open yet" "$LOGIN_BODY"; then
      pass "SITE_MODE=simple: /login redirects to /platform-disabled (private auth closed)"
    else
      bad "SITE_MODE=simple: /login did not land on platform-disabled copy (HTTP ${LOGIN_CODE})"
    fi
    ;;
  staff)
    if grep -q "Sign in to your claim" "$LOGIN_BODY"; then
      pass "SITE_MODE=staff: /login renders the sign-in form"
    else
      bad "SITE_MODE=staff: /login missing sign-in heading (HTTP ${LOGIN_CODE})"
    fi
    PORTAL_BODY="$(mktemp)"
    curl -fsS -L -o "$PORTAL_BODY" --max-time 15 "${BASE}/portal" >/dev/null || true
    if grep -q "Online claim accounts are not open yet" "$PORTAL_BODY"; then
      pass "SITE_MODE=staff: /portal stays closed (platform-disabled)"
    else
      bad "SITE_MODE=staff: /portal did not land on platform-disabled"
    fi
    rm -f "$PORTAL_BODY"
    ;;
  platform)
    if grep -q "Sign in to your claim" "$LOGIN_BODY"; then
      pass "SITE_MODE=platform: /login renders the sign-in form"
    else
      bad "SITE_MODE=platform: /login missing sign-in heading (HTTP ${LOGIN_CODE})"
    fi
    ;;
esac
rm -f "$LOGIN_BODY"

if [[ "$FAILS" -ne 0 ]]; then
  echo "doctor: ${FAILS} check(s) failed"
  exit 1
fi
echo "doctor: all checks passed"
exit 0
