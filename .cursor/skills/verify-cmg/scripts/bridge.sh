# Nested-Docker bridge workaround. Sourced from common.sh.
# Opt-in only. Never for a laptop or shared host.

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

supabase_bridge_subnet() {
  docker network inspect supabase_network_CMGPA --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || true
}

DOCKER_USER_DID_INSERT=0
insert_docker_user_rule() {
  local kind="$1" subnet="${2:-}"
  DOCKER_USER_DID_INSERT=0
  command -v sudo >/dev/null 2>&1 && command -v iptables >/dev/null 2>&1 || return 1
  if [[ "$kind" == "subnet" && -n "$subnet" ]]; then
    if sudo iptables -C DOCKER-USER -s "$subnet" -d "$subnet" -j ACCEPT >/dev/null 2>&1; then
      return 0
    fi
    sudo iptables -I DOCKER-USER 1 -s "$subnet" -d "$subnet" -j ACCEPT >/dev/null 2>&1 || return 1
    DOCKER_USER_DID_INSERT=1
    return 0
  fi
  if sudo iptables -C DOCKER-USER -i br+ -o br+ -j ACCEPT >/dev/null 2>&1; then
    return 0
  fi
  sudo iptables -I DOCKER-USER 1 -i br+ -o br+ -j ACCEPT >/dev/null 2>&1 || return 1
  DOCKER_USER_DID_INSERT=1
  return 0
}

delete_docker_user_rule() {
  local kind="$1" subnet="${2:-}"
  command -v sudo >/dev/null 2>&1 && command -v iptables >/dev/null 2>&1 || return 0
  if [[ "$kind" == "subnet" && -n "$subnet" ]]; then
    sudo iptables -D DOCKER-USER -s "$subnet" -d "$subnet" -j ACCEPT >/dev/null 2>&1 || true
    return 0
  fi
  sudo iptables -D DOCKER-USER -i br+ -o br+ -j ACCEPT >/dev/null 2>&1 || true
}

apply_bridge_forward() {
  [[ "$(uname -s)" == "Linux" ]] || return 0
  local prev4 prev6 inserted=0 kind="br" subnet=""
  if [[ -f "$BRIDGE_STATE" ]]; then
    write_sysctl bridge-nf-call-iptables 0 || true
    write_sysctl bridge-nf-call-ip6tables 0 || true
    refresh_docker_user_to_subnet
    log "bridge forward already recorded; re-applied without overwriting the snapshot"
    return 0
  fi
  prev4="$(cat /proc/sys/net/bridge/bridge-nf-call-iptables 2>/dev/null || echo "")"
  prev6="$(cat /proc/sys/net/bridge/bridge-nf-call-ip6tables 2>/dev/null || echo "")"
  write_sysctl bridge-nf-call-iptables 0 || log "could not set bridge-nf-call-iptables=0"
  write_sysctl bridge-nf-call-ip6tables 0 || log "could not set bridge-nf-call-ip6tables=0"
  subnet="$(supabase_bridge_subnet)"
  if [[ -n "$subnet" ]]; then
    kind="subnet"
  fi
  if insert_docker_user_rule "$kind" "$subnet"; then
    inserted="$DOCKER_USER_DID_INSERT"
  else
    kind="br"
    subnet=""
    if insert_docker_user_rule br; then
      inserted="$DOCKER_USER_DID_INSERT"
    fi
  fi
  node -e '
    const fs = require("fs");
    fs.writeFileSync(process.argv[1], JSON.stringify({
      iptables: process.argv[2],
      ip6tables: process.argv[3],
      dockerUserInserted: process.argv[4] === "1",
      dockerUserKind: process.argv[5],
      dockerUserSubnet: process.argv[6],
    }, null, 2) + "\n");
  ' "$BRIDGE_STATE" "$prev4" "$prev6" "$inserted" "$kind" "$subnet"
  log "applied nested-Docker bridge forward (opt-in, ${kind}); cleanup will restore"
}

# After the stack is up, prefer the supabase_network_* subnet over br+.
refresh_docker_user_to_subnet() {
  [[ -f "$BRIDGE_STATE" ]] || return 0
  local kind subnet inserted
  kind="$(json_get "$BRIDGE_STATE" dockerUserKind 2>/dev/null || echo br)"
  [[ "$kind" != "subnet" ]] || return 0
  subnet="$(supabase_bridge_subnet)"
  [[ -n "$subnet" ]] || return 0
  insert_docker_user_rule subnet "$subnet" || return 0
  delete_docker_user_rule br
  inserted="$DOCKER_USER_DID_INSERT"
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const cur = JSON.parse(fs.readFileSync(path, "utf8"));
    cur.dockerUserKind = "subnet";
    cur.dockerUserSubnet = process.argv[2];
    if (process.argv[3] === "1") cur.dockerUserInserted = true;
    fs.writeFileSync(path, JSON.stringify(cur, null, 2) + "\n");
  ' "$BRIDGE_STATE" "$subnet" "$inserted"
  log "upgraded Docker-user rule to supabase subnet ${subnet}"
}

restore_bridge_forward() {
  [[ -f "$BRIDGE_STATE" ]] || return 0
  local prev4 prev6 inserted kind subnet
  prev4="$(json_get "$BRIDGE_STATE" iptables 2>/dev/null || true)"
  prev6="$(json_get "$BRIDGE_STATE" ip6tables 2>/dev/null || true)"
  inserted="$(json_get "$BRIDGE_STATE" dockerUserInserted 2>/dev/null || echo 0)"
  kind="$(json_get "$BRIDGE_STATE" dockerUserKind 2>/dev/null || echo br)"
  subnet="$(json_get "$BRIDGE_STATE" dockerUserSubnet 2>/dev/null || true)"
  if [[ "$prev4" == "0" || "$prev4" == "1" ]]; then
    write_sysctl bridge-nf-call-iptables "$prev4" || true
  fi
  if [[ "$prev6" == "0" || "$prev6" == "1" ]]; then
    write_sysctl bridge-nf-call-ip6tables "$prev6" || true
  fi
  # Always delete the scoped rule this skill recorded, even if it pre-existed
  # (a crashed launch can leave the rule without dockerUserInserted=1).
  if [[ "$kind" == "subnet" || "$kind" == "br" ]]; then
    delete_docker_user_rule "$kind" "$subnet"
  fi
  rm -f "$BRIDGE_STATE"
  log "restored host bridge sysctl and Docker-user rule recorded at launch"
}

