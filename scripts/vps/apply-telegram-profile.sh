#!/usr/bin/env bash
# Idempotently merge scripts/vps/profiles/{dev|prod}.env into /opt/meriter/.env
# Optional: BOT_TOKEN env var updates token (used by CI deploy from GitHub secret).

set -euo pipefail

PROFILE="${1:-}"
ENV_FILE="${ENV_FILE:-/opt/meriter/.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_FILE="${SCRIPT_DIR}/profiles/${PROFILE}.env"

if [[ "$PROFILE" != "dev" && "$PROFILE" != "prod" ]]; then
  echo "[telegram-profile] ERROR: profile must be dev or prod, got: ${PROFILE:-empty}" >&2
  exit 1
fi

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "[telegram-profile] Profile file missing: $PROFILE_FILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"

upsert() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%$'\r'}"
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  upsert "$key" "$value"
done < "$PROFILE_FILE"

if [[ -n "${BOT_TOKEN:-}" ]]; then
  upsert "BOT_TOKEN" "$BOT_TOKEN"
  echo "[telegram-profile] BOT_TOKEN updated from environment"
fi

echo "[telegram-profile] Applied profile '${PROFILE}' to ${ENV_FILE}"
