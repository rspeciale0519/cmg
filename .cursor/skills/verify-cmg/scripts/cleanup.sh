#!/usr/bin/env bash
# Stop only processes this skill started. Keep evidence.
# Usage: cleanup.sh
# Never: pkill node, killall next, docker kill by image name.

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

if [[ ! -f "$STARTED_JSON" && ! -f "$RUN_DIR/app.pid" ]]; then
  restore_bridge_forward
  log "nothing recorded in ${RUN_DIR}; no processes to stop"
  log "evidence kept at ${EVIDENCE_ROOT}"
  exit 0
fi

APP_PID=""
STARTED_SUPABASE=0
if [[ -f "$STARTED_JSON" ]]; then
  APP_PID="$(json_get "$STARTED_JSON" appPid 2>/dev/null || true)"
  STARTED_SUPABASE="$(json_get "$STARTED_JSON" startedSupabase 2>/dev/null || echo 0)"
fi
if [[ -z "$APP_PID" && -f "$RUN_DIR/app.pid" ]]; then
  APP_PID="$(cat "$RUN_DIR/app.pid")"
fi

if [[ -n "$APP_PID" ]]; then
  log "stopping app pid ${APP_PID} and its children"
  kill_tree "$APP_PID" app || log "did not kill pid ${APP_PID}"
else
  log "no app pid recorded"
fi

if [[ "$STARTED_SUPABASE" == "true" || "$STARTED_SUPABASE" == "1" ]]; then
  ensure_docker "$@"
  log "stopping the Supabase stack this skill started (npm run db:stop)"
  npm run db:stop
else
  log "leaving Supabase running (this skill did not start it)"
fi

restore_bridge_forward

rm -f "$RUN_DIR/app.pid" "$STARTED_JSON" "$RUN_DIR/storage-owner.json"
log "runtime pid records removed; evidence kept at ${EVIDENCE_ROOT}"
ls -la "$EVIDENCE_ROOT" || true
