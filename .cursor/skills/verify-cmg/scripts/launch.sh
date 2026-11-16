#!/usr/bin/env bash
# Start local Supabase (if needed) and the Next.js app for verification.
# Usage: launch.sh [--mode simple|staff|platform] [--port 3000] [--reset] [--prod]
# --reset rebuilds the local database from migrations + supabase/seed.sql.
#          Use only against disposable data (fresh VM / empty data dir).
# --prod   serves `npm run build && npm run start` instead of `npm run dev`.

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
ensure_docker "$@"

MODE="$DEFAULT_MODE"
PORT="$DEFAULT_PORT"
RESET=0
PROD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) MODE="${2:?}"; shift 2 ;;
    --port) PORT="${2:?}"; shift 2 ;;
    --reset) RESET=1; shift ;;
    --prod) PROD=1; shift ;;
    -h|--help)
      sed -n '2,6p' "$0"
      exit 0
      ;;
    *) fail "unknown argument: $1" ;;
  esac
done

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

export SITE_MODE="$MODE"
export NEXT_PUBLIC_SITE_URL="http://${BASE_HOST}:${PORT}"
# Overlay local stack keys for this process. Do not rewrite an existing .env.local.
export NEXT_PUBLIC_SUPABASE_URL
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export SUPABASE_SECRET_KEY

# Official Cloudflare always-pass test keys from .env.example, if the process
# did not already inherit live keys. Launch never prints them.
if [[ -z "${NEXT_PUBLIC_TURNSTILE_SITE_KEY:-}" ]]; then
  export NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
fi
if [[ -z "${TURNSTILE_SECRET_KEY:-}" ]]; then
  export TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
fi

if command -v ss >/dev/null 2>&1 && ss -tln | grep -q ":${PORT} "; then
  fail "port ${PORT} is already in use. Pass --port or stop the occupant by PID."
fi

GIT_SHA="$(git rev-parse HEAD)"
log "starting app SITE_MODE=${MODE} port=${PORT} sha=${GIT_SHA} prod=${PROD}"

if [[ "$PROD" -eq 1 ]]; then
  npm run build
  nohup env SITE_MODE="$MODE" NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
    NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
    SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY="$NEXT_PUBLIC_TURNSTILE_SITE_KEY" \
    TURNSTILE_SECRET_KEY="$TURNSTILE_SECRET_KEY" \
    npm run start -- --hostname "$BASE_HOST" --port "$PORT" \
    >"$RUN_DIR/app.log" 2>&1 &
else
  nohup env SITE_MODE="$MODE" NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" \
    NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
    SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY="$NEXT_PUBLIC_TURNSTILE_SITE_KEY" \
    TURNSTILE_SECRET_KEY="$TURNSTILE_SECRET_KEY" \
    npm run dev -- --hostname "$BASE_HOST" --port "$PORT" \
    >"$RUN_DIR/app.log" 2>&1 &
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
}))' "$GIT_SHA" "$MODE" "$PORT" "$NEXT_PUBLIC_SITE_URL" "$APP_PID" "$STARTED_SUPABASE" "$RESET" "$PROD")"

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
