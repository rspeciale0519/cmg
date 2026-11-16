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

BRIDGE_STATE="$RUN_DIR/bridge-sysctl.json"

# Nested Docker with bridge-nf-call-iptables=1 can drop user-defined-bridge
# Postgres traffic. Do not apply this on a normal host. Opt in with
# VERIFY_CMG_BRIDGE_FORWARD=1 or launch.sh --bridge-forward. Cleanup restores.
write_sysctl() {
  local key="$1" value="$2"
  local path="/proc/sys/net/bridge/${key}"
  if [[ -w "$path" ]]; then
    echo "$value" >"$path" 2>/dev/null && return 0
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo sysctl -w "net.bridge.${key}=${value}" >/dev/null 2>&1 && return 0
  fi
  return 1
}

apply_bridge_forward() {
  [[ "$(uname -s)" == "Linux" ]] || return 0
  if [[ -f "$BRIDGE_STATE" ]]; then
    write_sysctl bridge-nf-call-iptables 0 || true
    write_sysctl bridge-nf-call-ip6tables 0 || true
    log "bridge forward already recorded; re-applied without overwriting the snapshot"
    return 0
  fi
  local prev4 prev6 inserted=0
  prev4="$(cat /proc/sys/net/bridge/bridge-nf-call-iptables 2>/dev/null || echo "")"
  prev6="$(cat /proc/sys/net/bridge/bridge-nf-call-ip6tables 2>/dev/null || echo "")"
  write_sysctl bridge-nf-call-iptables 0 || log "could not set bridge-nf-call-iptables=0"
  write_sysctl bridge-nf-call-ip6tables 0 || log "could not set bridge-nf-call-ip6tables=0"
  if command -v sudo >/dev/null 2>&1 && command -v iptables >/dev/null 2>&1; then
    if ! sudo iptables -C DOCKER-USER -j ACCEPT >/dev/null 2>&1; then
      if sudo iptables -I DOCKER-USER 1 -j ACCEPT >/dev/null 2>&1; then
        inserted=1
      fi
    fi
  fi
  node -e '
    const fs = require("fs");
    fs.writeFileSync(process.argv[1], JSON.stringify({
      iptables: process.argv[2],
      ip6tables: process.argv[3],
      dockerUserAcceptInserted: process.argv[4] === "1",
    }, null, 2) + "\n");
  ' "$BRIDGE_STATE" "$prev4" "$prev6" "$inserted"
  log "applied nested-Docker bridge forward (opt-in); cleanup will restore prior sysctl"
}

restore_bridge_forward() {
  [[ -f "$BRIDGE_STATE" ]] || return 0
  local prev4 prev6 inserted
  prev4="$(json_get "$BRIDGE_STATE" iptables 2>/dev/null || true)"
  prev6="$(json_get "$BRIDGE_STATE" ip6tables 2>/dev/null || true)"
  inserted="$(json_get "$BRIDGE_STATE" dockerUserAcceptInserted 2>/dev/null || echo 0)"
  if [[ "$prev4" == "0" || "$prev4" == "1" ]]; then
    write_sysctl bridge-nf-call-iptables "$prev4" || true
  fi
  if [[ "$prev6" == "0" || "$prev6" == "1" ]]; then
    write_sysctl bridge-nf-call-ip6tables "$prev6" || true
  fi
  if [[ "$inserted" == "true" || "$inserted" == "1" ]] && command -v sudo >/dev/null 2>&1; then
    sudo iptables -D DOCKER-USER -j ACCEPT >/dev/null 2>&1 || true
  fi
  rm -f "$BRIDGE_STATE"
  log "restored host bridge sysctl recorded at launch"
}

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

# Load local stack URLs/keys into the current shell without printing them.
load_supabase_env() {
  local envfile
  envfile="$(mktemp)"
  # `supabase status -o env` prints KEY=value lines suitable for eval.
  if ! run_supabase status -o env >"$envfile" 2>/dev/null; then
    rm -f "$envfile"
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$envfile"
  set +a
  rm -f "$envfile"
  export NEXT_PUBLIC_SUPABASE_URL="${API_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
  export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}}}"
  export SUPABASE_SECRET_KEY="${SECRET_KEY:-${SERVICE_ROLE_KEY:-${SUPABASE_SECRET_KEY:-}}}"
  if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}" || -z "${SUPABASE_SECRET_KEY:-}" ]]; then
    return 1
  fi
}

supabase_running() {
  load_supabase_env 2>/dev/null || return 1
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

# Kill one PID and its descendants. Never kill by process name.
kill_tree() {
  local pid="$1"
  [[ -n "$pid" ]] || return 0
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
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

utc_stamp() {
  date -u +"%Y%m%dT%H%M%SZ"
}
