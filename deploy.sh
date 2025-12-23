#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# If COMMIT_SHA is provided, use SHA-based image tags for unambiguous deployment
if [ -n "${COMMIT_SHA:-}" ]; then
  export VERSION_API="sha-${COMMIT_SHA}"
  echo "[deploy] Using SHA-based image tags: ${VERSION_API}"
else
  echo "[deploy] No COMMIT_SHA provided, using latest tag (fallback)"
fi

# Deploy static web files if artifact exists
if [ -f /tmp/web-static.tar.gz ]; then
  echo "[deploy] Deploying static web files..."
  
  # Create web/out directory if it doesn't exist
  mkdir -p web/out
  
  # Create backup of current deployment
  if [ -d web/out ] && [ "$(ls -A web/out 2>/dev/null)" ]; then
    BACKUP_DIR="web/out.backup.$(date +%Y%m%d_%H%M%S)"
    echo "[deploy] Creating backup: ${BACKUP_DIR}"
    cp -r web/out "${BACKUP_DIR}"
    
    # Clean up old backups (keep last 3)
    echo "[deploy] Cleaning up old backups..."
    ls -dt web/out.backup.* 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
  fi
  
  # Extract to temporary location
  TEMP_DIR="web/out.tmp"
  rm -rf "${TEMP_DIR}"
  mkdir -p "${TEMP_DIR}"
  
  echo "[deploy] Extracting static files..."
  tar -xzf /tmp/web-static.tar.gz -C "${TEMP_DIR}"
  
  # Atomically replace deployment
  echo "[deploy] Replacing deployment..."
  if [ -d web/out ]; then
    mv web/out web/out.old
  fi
  mv "${TEMP_DIR}" web/out
  rm -rf web/out.old 2>/dev/null || true
  
  # Clean up uploaded artifact
  rm -f /tmp/web-static.tar.gz
  
  echo "[deploy] Static web files deployed successfully"
  
  # Reload Caddy to pick up new files
  echo "[deploy] Reloading Caddy..."
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || echo "[deploy] Warning: Could not reload Caddy (may not be running)"
else
  echo "[deploy] No static web artifact found, skipping web deployment"
fi

echo "[deploy] Pulling API images..."
docker compose pull api || echo "[deploy] Warning: Could not pull API image"

echo "[deploy] Recreating containers..."
docker compose up -d

echo "[deploy] Cleaning old images..."
docker image prune -f

echo "[deploy] Done."
