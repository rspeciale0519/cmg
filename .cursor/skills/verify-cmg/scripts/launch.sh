#!/usr/bin/env bash
# Start local Supabase (if needed) and the Next.js app for verification.
# Usage: launch.sh [--mode simple|staff|platform] [--port 3000] [--reset] [--prod]
#                  [--bridge-forward] [--live-vendors]
# --reset           rebuilds the local database from migrations + supabase/seed.sql.
#                   Use only against disposable data (fresh VM / empty data dir).
# --prod            serves `npm run build && npm run start` instead of `npm run dev`.
# --bridge-forward  nested-Docker cloud VMs only, never a laptop or shared host
#                   (VERIFY_CMG_BRIDGE_FORWARD=1). Cleanup restores sysctl + the
#                   scoped DOCKER-USER rule.
# --live-vendors    keep inherited Resend/PandaDoc/cron keys (VERIFY_CMG_LIVE_VENDORS=1).
#                   Default: overlay empty vendor keys so .env.local cannot send.

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
ensure_docker "$@"

MODE="$DEFAULT_MODE"
PORT="$DEFAULT_PORT"
RESET=0
PROD=0
BRIDGE_FORWARD=0
LIVE_VENDORS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) MODE="${2:?}"; shift 2 ;;
    --port) PORT="${2:?}"; shift 2 ;;
    --reset) RESET=1; shift ;;
    --prod) PROD=1; shift ;;
    --bridge-forward) BRIDGE_FORWARD=1; shift ;;
    --live-vendors) LIVE_VENDORS=1; shift ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) fail "unknown argument: $1" ;;
  esac
done

require_app_port "$PORT"

if [[ "${VERIFY_CMG_BRIDGE_FORWARD:-}" == "1" ]]; then
  BRIDGE_FORWARD=1
fi
if [[ "${VERIFY_CMG_LIVE_VENDORS:-}" == "1" ]]; then
  LIVE_VENDORS=1
fi

if [[ "$BRIDGE_FORWARD" -eq 1 ]]; then
  apply_bridge_forward
fi

case "$MODE" in
  simple|staff|platform) ;;
  *) fail "SITE_MODE must be simple, staff, or platform (got '$MODE')" ;;
esac

if [[ -f "$STARTED_JSON" ]] && json_get "$STARTED_JSON" appPid >/dev/null 2>&1; then
  existing="$(json_get "$STARTED_JSON" appPid)"
  if kill -0 "$existing" 2>/dev/null; then
    fail "an app this skill started is still running (pid $existing). Run cleanup.sh first."
  fi
fi

ensure_env_local

STARTED_SUPABASE=0
if supabase_running; then
  log "local Supabase already healthy on ${NEXT_PUBLIC_SUPABASE_URL}"
else
  log "starting local Supabase (host ports 15420-15429, project_id CMGPA)"
  # CLI status dumps keys; keep them out of the terminal and out of git.
  npm run db:start >"$RUN_DIR/supabase-start.log" 2>&1
  STARTED_SUPABASE=1
  supabase_running || fail "supabase start finished but auth health is not ready (see run/supabase-start.log)"
fi

if [[ "$RESET" -eq 1 ]]; then
  log "resetting disposable local database (migrations + seed.sql)"
  npm run db:reset >"$RUN_DIR/supabase-reset.log" 2>&1
  supabase_running || fail "database reset left auth unhealthy (see run/supabase-reset.log)"
fi

load_supabase_env || fail "could not read supabase status -o env"

if [[ "$BRIDGE_FORWARD" -eq 1 ]]; then
  refresh_docker_user_to_subnet
fi

export SITE_MODE="$MODE"
export NEXT_PUBLIC_SITE_URL="http://${BASE_HOST}:${PORT}"
# Overlay local stack keys for this process. Do not rewrite an existing .env.local.
export NEXT_PUBLIC_SUPABASE_URL
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export SUPABASE_SECRET_KEY

# Local stack (M1) always gets Cloudflare always-pass Turnstile keys.
force_turnstile_test_keys

# Next loads .env.local in-process. Empty overlays win over a real key on disk
# unless VERIFY_CMG_LIVE_VENDORS=1 / --live-vendors.
if [[ "$LIVE_VENDORS" -eq 1 ]]; then
  log "live vendors opt-in: inherited Resend/PandaDoc/cron keys are unchanged"
else
  blank_vendor_keys
  log "overlaying empty vendor keys (Resend/PandaDoc/cron); --live-vendors to send"
fi

if command -v ss >/dev/null 2>&1 && ss -tln | grep -q ":${PORT} "; then
  fail "port ${PORT} is already in use. Pass --port or stop the occupant by PID."
fi

GIT_SHA="$(git rev-parse HEAD)"
log "starting app SITE_MODE=${MODE} port=${PORT} sha=${GIT_SHA} prod=${PROD}"

start_app() {
  local npm_script="$1"
  nohup env SITE_MODE="$MODE" NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
    NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
    SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY="$NEXT_PUBLIC_TURNSTILE_SITE_KEY" \
    TURNSTILE_SECRET_KEY="$TURNSTILE_SECRET_KEY" \
    RESEND_API_KEY="${RESEND_API_KEY-}" \
    PANDADOC_API_KEY="${PANDADOC_API_KEY-}" \
    PANDADOC_WEBHOOK_SHARED_KEY="${PANDADOC_WEBHOOK_SHARED_KEY-}" \
    PANDADOC_DRAFT_TEST_EMAIL="${PANDADOC_DRAFT_TEST_EMAIL-}" \
    PANDADOC_LOR_TEMPLATE_UUID="${PANDADOC_LOR_TEMPLATE_UUID-}" \
    PANDADOC_LOR_TEMPLATE_UUID_SINGLE="${PANDADOC_LOR_TEMPLATE_UUID_SINGLE-}" \
    CRON_SECRET="${CRON_SECRET-}" \
    PANDADOC_LIVE_DRAFT_TEST="${PANDADOC_LIVE_DRAFT_TEST-}" \
    npm run "$npm_script" -- --hostname "$BASE_HOST" --port "$PORT" \
    >"$RUN_DIR/app.log" 2>&1 &
}

if [[ "$PROD" -eq 1 ]]; then
  npm run build
  start_app start
else
  start_app dev
fi
APP_PID=$!
echo "$APP_PID" >"$RUN_DIR/app.pid"

write_started "$(node -e 'console.log(JSON.stringify({
  startedAt: new Date().toISOString(),
  gitSha: process.argv[1],
  siteMode: process.argv[2],
  port: Number(process.argv[3]),
  baseUrl: process.argv[4],
  appPid: Number(process.argv[5]),
  startedSupabase: process.argv[6] === "1",
  resetDb: process.argv[7] === "1",
  prod: process.argv[8] === "1",
  liveVendors: process.argv[9] === "1",
  bridgeForward: process.argv[10] === "1",
}))' "$GIT_SHA" "$MODE" "$PORT" "$NEXT_PUBLIC_SITE_URL" "$APP_PID" "$STARTED_SUPABASE" "$RESET" "$PROD" "$LIVE_VENDORS" "$BRIDGE_FORWARD")"

log "waiting for doctor (usable homepage, not only a bound port)"
for i in $(seq 1 90); do
  if "$SCRIPT_DIR/doctor.sh" >/dev/null 2>&1; then
    log "ready at ${NEXT_PUBLIC_SITE_URL} (SITE_MODE=${MODE})"
    "$SCRIPT_DIR/doctor.sh"
    exit 0
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    tail -n 80 "$RUN_DIR/app.log" >&2 || true
    fail "app process ${APP_PID} exited before becoming ready"
  fi
  sleep 2
done

tail -n 80 "$RUN_DIR/app.log" >&2 || true
fail "app did not become usable within 180s"
