#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Prints why Mongo / rs-init failed (health log, container logs, one mongosh probe). No secrets.
deploy_mongo_diagnostics() {
  echo "[deploy] ========== diagnostics: mongo / api =========="
  docker compose ps -a 2>/dev/null || true
  for c in meriter-mongodb meriter-mongodb-rs-init meriter-api; do
    if docker ps -a --format '{{.Names}}' | grep -qx "$c"; then
      echo "[deploy] --- docker inspect $c (status / health) ---"
      docker inspect "$c" --format 'Status={{.State.Status}} ExitCode={{.State.ExitCode}} OOMKilled={{.State.OOMKilled}} Error={{.State.Error}}' 2>/dev/null || true
      docker inspect "$c" --format '{{json .State.Health}}' 2>/dev/null | head -c 32000 || true
      echo
      echo "[deploy] --- logs $c (last 120 lines) ---"
      docker logs "$c" 2>&1 | tail -120 || true
    fi
  done
  if docker ps --format '{{.Names}}' | grep -qx meriter-mongodb; then
    echo "[deploy] --- manual mongosh (admin auth + rs.status); password length only ---"
    # bash -lc: expand MONGO_* inside the container (not on the deploy host).
    docker exec meriter-mongodb bash -lc 'echo "MONGO_INITDB_ROOT_USERNAME=$MONGO_INITDB_ROOT_USERNAME"; echo "MONGO_INITDB_ROOT_PASSWORD_length=${#MONGO_INITDB_ROOT_PASSWORD}"; mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --host 127.0.0.1 --port 27017 --eval "try{const s=rs.status();if(s.myState===1)quit(0);quit(1)}catch(e){print(String(e));quit(1)}"' 2>&1 || true
  else
    echo "[deploy] meriter-mongodb not running; skip exec probe"
  fi
  echo "[deploy] ========== end diagnostics =========="
}

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
if ! docker compose up -d; then
  echo "[deploy] docker compose up -d failed"
  deploy_mongo_diagnostics
  exit 1
fi

echo "[deploy] Cleaning old images..."
docker image prune -f

echo "[deploy] Done."
