#!/usr/bin/env bash
# Run the repo's static verification gates and write a summary.
# Usage: static-gates.sh [--with-db]
# --with-db  also runs db:reset (disposable data only), db:test, and the
#            database-backed Vitest selection from .github/workflows/ci.yml.

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

WITH_DB=0
[[ "${1:-}" == "--with-db" ]] && WITH_DB=1

SUMMARY="$RUN_DIR/static-gates.txt"
mkdir -p "$RUN_DIR"
: >"$SUMMARY"

run_gate() {
  local name="$1"
  shift
  log "gate: $name"
  local logf="$RUN_DIR/gate-${name}.log"
  local status=0
  if "$@" >"$logf" 2>&1; then
    status=0
    echo "PASS  ${name}  ($*)" | tee -a "$SUMMARY"
  else
    status=$?
    echo "FAIL  ${name}  exit ${status}  ($*)" | tee -a "$SUMMARY"
    tail -n 40 "$logf" >&2 || true
  fi
  return $status
}

ensure_env_local

FAILS=0
run_gate type-check npm run type-check || FAILS=$((FAILS + 1))
run_gate lint npm run lint || FAILS=$((FAILS + 1))
run_gate unit-test npm test || FAILS=$((FAILS + 1))
# Same placeholders CI uses in .github/workflows/ci.yml when no live stack is required for compile.
run_gate build env \
  NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:15421}" \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-build-placeholder}" \
  NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}" \
  npm run build || FAILS=$((FAILS + 1))
run_gate audit npm audit --audit-level=high || FAILS=$((FAILS + 1))

if [[ "$WITH_DB" -eq 1 ]]; then
  ensure_docker "$@"
  if ! supabase_running; then
    log "starting Supabase for database gates"
    npm run db:start
  fi
  run_gate db-reset npm run db:reset || FAILS=$((FAILS + 1))
  run_gate db-test npm run db:test || FAILS=$((FAILS + 1))
  load_supabase_env || fail "supabase status -o env failed"
  run_gate db-vitest env \
    NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    SUPABASE_SECRET_KEY="$SUPABASE_SECRET_KEY" \
    npx vitest run src/lib/esign src/app/api/pandadoc src/lib/storage-cleanup src/lib/admin/partners.test.ts \
    || FAILS=$((FAILS + 1))
fi

echo "----- summary -----"
cat "$SUMMARY"
if [[ "$FAILS" -ne 0 ]]; then
  fail "${FAILS} gate(s) failed; logs in ${RUN_DIR}/gate-*.log"
fi
log "all requested gates passed"
