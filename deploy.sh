#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Dev CI publishes web-dev-latest / api-dev-latest (and full-sha tags). Use those on dev VPS.
if [ "${USE_DEV_IMAGE_TAGS:-}" = "true" ]; then
  export VERSION_WEB="web-dev-latest"
  export VERSION_API="api-dev-latest"
  echo "[deploy] Using dev rolling image tags: ${VERSION_WEB}, ${VERSION_API}"
# Stage/prod: pin to short SHA tags (see build-and-push release job)
elif [ -n "${COMMIT_SHA:-}" ]; then
  export VERSION_WEB="sha-${COMMIT_SHA}"
  export VERSION_API="sha-${COMMIT_SHA}"
  echo "[deploy] Using SHA-based image tags: ${VERSION_WEB}"
else
  echo "[deploy] No COMMIT_SHA / USE_DEV_IMAGE_TAGS; using compose defaults (often :latest)"
fi

echo "[deploy] Pulling images..."
docker compose pull

echo "[deploy] Recreating containers..."
docker compose up -d

echo "[deploy] Cleaning old images..."
docker image prune -f

echo "[deploy] Done."
