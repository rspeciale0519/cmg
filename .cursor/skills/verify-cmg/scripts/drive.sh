#!/usr/bin/env bash
# Drive one mapped feature with Playwright (npx, not a package.json dependency).
# Usage: drive.sh <journey>
# Journeys: public-contact | public-intake | staff-login | admin-claims |
#           customer-portal | partner-directory
# SITE_MODE must already match the journey (see SKILL.md). Doctor must pass.

# shellcheck source=common.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

JOURNEY="${1:?usage: drive.sh <journey>}"
case "$JOURNEY" in
  public-contact|public-intake|staff-login|admin-claims|customer-portal|partner-directory) ;;
  *) fail "unknown journey '$JOURNEY'" ;;
esac

"$SCRIPT_DIR/doctor.sh" || fail "doctor must pass before driving"

BASE="$(app_base_url)"
STAMP="$(utc_stamp)"
EVIDENCE_DIR="$EVIDENCE_ROOT/${STAMP}-${JOURNEY}"
mkdir -p "$EVIDENCE_DIR"
export VERIFY_EVIDENCE_DIR="$EVIDENCE_DIR"
export VERIFY_BASE_URL="$BASE"

log "installing Playwright into the skill harness (not the app package.json)"
# Isolated prefix so Node can resolve @playwright/test next to the config.
# The app package.json is never modified.
if [[ ! -d "$SCRIPT_DIR/node_modules/@playwright/test" ]]; then
  npm install --prefix "$SCRIPT_DIR" --no-fund --no-audit --save-dev "$PLAYWRIGHT_PKG"
fi
npx --prefix "$SCRIPT_DIR" playwright install chromium

log "driving ${JOURNEY} against ${BASE}; evidence -> ${EVIDENCE_DIR}"
set +e
npx --prefix "$SCRIPT_DIR" playwright test \
  --config "$SCRIPT_DIR/playwright.config.mjs" \
  --grep "$(
    case "$JOURNEY" in
      public-contact) echo "simple-mode public contact" ;;
      public-intake) echo "simple-mode public claim intake" ;;
      staff-login) echo "staff login and AAL2" ;;
      admin-claims) echo "admin claim management" ;;
      customer-portal) echo "customer portal" ;;
      partner-directory) echo "partner directory|partner portal" ;;
    esac
  )"
STATUS=$?
set -e

node -e '
const fs = require("fs");
const dir = process.env.VERIFY_EVIDENCE_DIR;
const meta = {
  journey: process.argv[1],
  baseUrl: process.env.VERIFY_BASE_URL,
  evidenceDir: dir,
  exitCode: Number(process.argv[2]),
  finishedAt: new Date().toISOString(),
};
fs.writeFileSync(dir + "/drive-result.json", JSON.stringify(meta, null, 2) + "\n");
' "$JOURNEY" "$STATUS"

log "evidence directory (survives cleanup): ${EVIDENCE_DIR}"
ls -la "$EVIDENCE_DIR" || true
exit "$STATUS"
