#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# If COMMIT_SHA is provided, use SHA-based image tags for unambiguous deployment
if [ -n "${COMMIT_SHA:-}" ]; then
  export VERSION_WEB="sha-${COMMIT_SHA}"
  export VERSION_API="sha-${COMMIT_SHA}"
  echo "[deploy] Using SHA-based image tags: ${VERSION_WEB}"
else
  echo "[deploy] No COMMIT_SHA provided, using latest tag (fallback)"
fi

echo "[deploy] Pulling images..."
docker compose pull

echo "[deploy] Recreating containers..."
docker compose up -d

echo "[deploy] Cleaning old images..."
docker image prune -f

echo "[deploy] Done."
