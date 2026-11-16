# Shared paths and helpers for verify-cmg. Source from the other scripts.
# Do not print secrets.

set -euo pipefail

verify_cmg_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$here"
  while [[ ! -d .git && "$PWD" != "/" ]]; do
    cd ..
  done
  git rev-parse --show-toplevel
}

ROOT="$(verify_cmg_root)"
SKILL_DIR="$ROOT/.cursor/skills/verify-cmg"
SCRIPT_DIR="$SKILL_DIR/scripts"
RUN_DIR="$SKILL_DIR/run"
EVIDENCE_ROOT="$SKILL_DIR/evidence"
DEFAULT_PORT="${VERIFY_PORT:-3000}"
DEFAULT_MODE="${SITE_MODE:-simple}"
BASE_HOST="127.0.0.1"
PLAYWRIGHT_VERSION="1.56.1"
PLAYWRIGHT_PKG="@playwright/test@${PLAYWRIGHT_VERSION}"
STARTED_JSON="$RUN_DIR/started.json"

mkdir -p "$RUN_DIR" "$EVIDENCE_ROOT"

cd "$ROOT"

fail() {
  echo "verify-cmg: $*" >&2
  exit 1
}

log() {
  echo "verify-cmg: $*"
}

# shellcheck source=bridge.sh
source "$SCRIPT_DIR/bridge.sh"

# Re-exec under the docker group when the daemon is up but this shell lacks it.
# Database-backed Vitest also shells out to `docker inspect`/`docker exec`.
ensure_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  if getent group docker >/dev/null 2>&1 && getent group docker | grep -qw "${USER:-ubuntu}"; then
    if [[ "${VERIFY_CMG_DOCKER_REEXEC:-}" == "1" ]]; then
      fail "Docker group re-exec already attempted and docker info still fails"
    fi
    log "re-executing under the docker group"
    exec env VERIFY_CMG_DOCKER_REEXEC=1 sg docker -c "cd $(printf %q "$ROOT") && $(printf %q "$0") $(printf '%q ' "$@")"
  fi
  fail "Docker daemon is not reachable. Local Supabase needs Docker (ports 15420-15429)."
}

json_get() {
  local file="$1" key="$2"
  node -e 'const fs=require("fs"); const o=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); const v=o[process.argv[2]]; if (v===undefined||v===null) process.exit(2); process.stdout.write(String(v));' "$file" "$key"
}

write_started() {
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const next = JSON.parse(process.argv[2]);
    let cur = {};
    try { cur = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}
    fs.writeFileSync(path, JSON.stringify({ ...cur, ...next }, null, 2) + "\n");
  ' "$STARTED_JSON" "$1"
}

run_supabase() {
  if docker info >/dev/null 2>&1; then
    supabase "$@"
  elif getent group docker >/dev/null 2>&1 && getent group docker | grep -qw "${USER:-ubuntu}"; then
    sg docker -c "$(printf '%q ' supabase "$@")"
  else
    supabase "$@"
  fi
}

# Hard-fail unless the host is loopback. Callers: launch, doctor, side-effects.
require_local_supabase_url() {
  local url="${1:-}"
  local host=""
  [[ -n "$url" ]] || fail "supabase URL missing from status -o env"
  host="$(node -e 'try { process.stdout.write(new URL(process.argv[1]).hostname); } catch { process.exit(2); }' "$url")" \
    || fail "supabase URL from status -o env is not a valid URL"
  case "$host" in
    127.0.0.1|localhost) return 0 ;;
    *) fail "refusing non-local supabase URL host '${host}' (need 127.0.0.1 or localhost)" ;;
  esac
}

# Load URLs/keys ONLY from `supabase status -o env`. No inherited-env fallback.
load_supabase_env() {
  local envfile
  envfile="$(mktemp)"
  unset API_URL ANON_KEY PUBLISHABLE_KEY SECRET_KEY SERVICE_ROLE_KEY
  unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY
  if ! run_supabase status -o env >"$envfile" 2>/dev/null; then
    rm -f "$envfile"
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$envfile"
  set +a
  rm -f "$envfile"
  [[ -n "${API_URL:-}" ]] || return 1
  require_local_supabase_url "$API_URL"
  export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
  export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"
  export SUPABASE_SECRET_KEY="${SECRET_KEY:-${SERVICE_ROLE_KEY:-}}"
  if [[ -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" || -z "${SUPABASE_SECRET_KEY:-}" ]]; then
    return 1
  fi
}

supabase_running() {
  # Do not swallow stderr: a non-local URL must hard-fail with its message.
  load_supabase_env || return 1
  curl -fsS --max-time 5 "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health" >/dev/null
}

ensure_env_local() {
  if [[ ! -f "$ROOT/.env.local" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env.local"
    log "created .env.local from .env.example (Turnstile always-pass test keys, empty Resend/PandaDoc)"
  fi
}

app_base_url() {
  local port mode
  if [[ -f "$STARTED_JSON" ]]; then
    port="$(json_get "$STARTED_JSON" port 2>/dev/null || true)"
  fi
  port="${port:-$DEFAULT_PORT}"
  echo "http://${BASE_HOST}:${port}"
}

require_app_port() {
  local port="$1"
  [[ "$port" =~ ^[0-9]+$ ]] || fail "port must be an integer (got '${port}')"
  if (( port < 1024 || port > 65535 )); then
    fail "port must be 1024-65535 (got ${port})"
  fi
}

cmdline_is_app() {
  local pid="$1" cmd
  [[ -r "/proc/${pid}/cmdline" ]] || return 1
  cmd="$(tr '\0' ' ' < "/proc/${pid}/cmdline")"
  [[ "$cmd" == *npm* || "$cmd" == *next* ]]
}

# Kill one PID and its descendants. Never kill by process name.
# Pass "app" as \$2 to refuse a stale pid whose cmdline is not npm/next.
kill_tree() {
  local pid="$1"
  local require_app="${2:-}"
  [[ -n "$pid" ]] || return 0
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  if [[ "$require_app" == "app" ]] && ! cmdline_is_app "$pid"; then
    log "recorded pid ${pid} cmdline is not npm/next; dropping stale record without kill"
    return 2
  fi
  local child
  while read -r child; do
    [[ -n "$child" ]] || continue
    kill_tree "$child"
  done < <(pgrep -P "$pid" || true)
  kill "$pid" 2>/dev/null || true
  sleep 0.2
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

proc_env_value() {
  local pid="$1" key="$2"
  [[ -r "/proc/${pid}/environ" ]] || return 1
  tr '\0' '\n' < "/proc/${pid}/environ" | awk -F= -v k="$key" '$1==k { print substr($0, index($0, "=")+1); exit }'
}

# Outbound / paid vendor keys from .env.example. Empty unless VERIFY_CMG_LIVE_VENDORS=1.
vendor_key_names() {
  printf '%s\n' \
    RESEND_API_KEY \
    PANDADOC_API_KEY \
    PANDADOC_WEBHOOK_SHARED_KEY \
    PANDADOC_DRAFT_TEST_EMAIL \
    PANDADOC_LOR_TEMPLATE_UUID \
    PANDADOC_LOR_TEMPLATE_UUID_SINGLE \
    CRON_SECRET
}

blank_vendor_keys() {
  local key
  while read -r key; do
    [[ -n "$key" ]] || continue
    export "${key}="
  done < <(vendor_key_names)
  unset PANDADOC_LIVE_DRAFT_TEST
}

force_turnstile_test_keys() {
  export NEXT_PUBLIC_TURNSTILE_SITE_KEY="1x00000000000000000000AA"
  export TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
}

utc_stamp() {
  date -u +"%Y%m%dT%H%M%SZ"
}
