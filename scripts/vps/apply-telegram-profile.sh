#!/usr/bin/env bash
# Idempotently merge scripts/vps/profiles/{dev|prod}.env into /opt/meriter/.env
# Optional: BOT_TOKEN env var updates token (used by CI deploy from GitHub secret).
# Pass --check as the second argument to validate without writing.

set -euo pipefail

PROFILE="${1:-}"
CHECK_ONLY=false
if [[ "${2:-}" == "--check" ]]; then
  CHECK_ONLY=true
fi

ENV_FILE="${ENV_FILE:-/opt/meriter/.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_FILE="${PROFILE_FILE:-${SCRIPT_DIR}/profiles/${PROFILE}.env}"
UUID_RE='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

if [[ "$PROFILE" != "dev" && "$PROFILE" != "prod" ]]; then
  echo "[telegram-profile] ERROR: profile must be dev or prod, got: ${PROFILE:-empty}" >&2
  exit 1
fi

if [[ ! -f "$PROFILE_FILE" ]]; then
  echo "[telegram-profile] Profile file missing: $PROFILE_FILE" >&2
  exit 1
fi

validate_profile() {
  local key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    key="${line%%=*}"
    value="${line#*=}"

    if [[ -z "$value" ]]; then
      echo "[telegram-profile] ERROR: ${key} must not be empty" >&2
      return 1
    fi
    if [[ "$value" == REPLACE_WITH_* ]]; then
      echo "[telegram-profile] ERROR: ${key} still has a placeholder value" >&2
      return 1
    fi
    if [[ "$key" == "DEFAULT_TELEGRAM_COMMUNITY_ID" && ! "$value" =~ $UUID_RE ]]; then
      echo "[telegram-profile] ERROR: DEFAULT_TELEGRAM_COMMUNITY_ID must be a UUID" >&2
      return 1
    fi
    if [[ "$PROFILE" == "prod" && "$key" == *_URL && "$value" != https://* ]]; then
      echo "[telegram-profile] ERROR: ${key} must be an HTTPS URL in production" >&2
      return 1
    fi
  done < "$PROFILE_FILE"
}

validate_profile

if [[ "$CHECK_ONLY" == true ]]; then
  echo "[telegram-profile] Check passed for profile '${PROFILE}'"
  exit 0
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
