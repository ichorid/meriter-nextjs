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

# Determine static web artifact filename
# Priority: 1) WEB_STATIC_ARTIFACT_NAME env var, 2) Find by pattern, 3) Fallback
ARTIFACT_FILE=""

if [ -n "${WEB_STATIC_ARTIFACT_NAME:-}" ]; then
  # Use explicitly provided filename
  ARTIFACT_FILE="/tmp/${WEB_STATIC_ARTIFACT_NAME}"
  echo "[deploy] Using artifact filename from env: ${ARTIFACT_FILE}"
elif [ -n "${COMMIT_SHA:-}" ]; then
  # Try to find file matching commit hash patterns
  # Try dev pattern first, then generic pattern
  for pattern in "web-static-dev-${COMMIT_SHA}.tar.gz" "web-static-${COMMIT_SHA}.tar.gz"; do
    if [ -f "/tmp/${pattern}" ]; then
      ARTIFACT_FILE="/tmp/${pattern}"
      echo "[deploy] Found artifact matching pattern: ${ARTIFACT_FILE}"
      break
    fi
  done
  
  # If no exact match, try to find any web-static-*.tar.gz file
  if [ -z "$ARTIFACT_FILE" ]; then
    FOUND_FILE=$(ls /tmp/web-static-*.tar.gz 2>/dev/null | head -n 1)
    if [ -n "$FOUND_FILE" ]; then
      ARTIFACT_FILE="$FOUND_FILE"
      echo "[deploy] Found artifact by pattern: ${ARTIFACT_FILE}"
    fi
  fi
else
  # Fallback to default pattern
  ARTIFACT_FILE="/tmp/web-static.tar.gz"
  echo "[deploy] Using default artifact filename: ${ARTIFACT_FILE}"
fi

# Deploy static web files if artifact exists
if [ -n "$ARTIFACT_FILE" ] && [ -f "$ARTIFACT_FILE" ]; then
    echo "[deploy] Deploying static web files from ${ARTIFACT_FILE}..."
    
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
    
    echo "[deploy] Extracting static files from ${ARTIFACT_FILE}..."
    tar -xzf "${ARTIFACT_FILE}" -C "${TEMP_DIR}"
    
    # Atomically replace deployment
    echo "[deploy] Replacing deployment..."
    if [ -d web/out ]; then
      mv web/out web/out.old
    fi
    mv "${TEMP_DIR}" web/out
    rm -rf web/out.old 2>/dev/null || true
    
    # Clean up uploaded artifact
    rm -f "${ARTIFACT_FILE}"
    
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
