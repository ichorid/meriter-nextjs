#!/usr/bin/env bash
# Dump meriter database from the local Docker Mongo container.
# Run on VPS: bash /opt/meriter/scripts/vps/mongodb-backup.sh
#
# Output: /opt/meriter/backups/meriter-YYYY-MM-DDTHH-MM-SSZ.tar.gz

set -euo pipefail

ROOT="${ROOT:-/opt/meriter}"
ENV_FILE="${ENV_FILE:-${ROOT}/.env}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT_DIR="${BACKUP_DIR}/meriter-${STAMP}"
ARCHIVE="${BACKUP_DIR}/meriter-${STAMP}.tar.gz"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[mongo-backup] ERROR: missing ${ENV_FILE}" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${MONGO_ADMIN_PASSWORD:-}" ]]; then
  echo "[mongo-backup] ERROR: MONGO_ADMIN_PASSWORD not set in ${ENV_FILE}" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx meriter-mongodb; then
  echo "[mongo-backup] ERROR: meriter-mongodb container is not running" >&2
  exit 1
fi

mkdir -p "$OUT_DIR" "$BACKUP_DIR"

echo "[mongo-backup] Dumping database meriter → ${OUT_DIR}"
docker exec meriter-mongodb mongodump \
  --quiet \
  -u admin \
  -p "$MONGO_ADMIN_PASSWORD" \
  --authenticationDatabase admin \
  --db meriter \
  --out "/tmp/meriter-dump-${STAMP}"

docker cp "meriter-mongodb:/tmp/meriter-dump-${STAMP}/meriter" "${OUT_DIR}/"
docker exec meriter-mongodb rm -rf "/tmp/meriter-dump-${STAMP}"

tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$(basename "$OUT_DIR")"
rm -rf "$OUT_DIR"

echo "[mongo-backup] Done: ${ARCHIVE}"
ls -lh "$ARCHIVE"
