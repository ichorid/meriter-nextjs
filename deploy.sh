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
    
    # web-static is the parent directory that gets mounted
    STATIC_DIR="web-static"
    mkdir -p "${STATIC_DIR}"
    
    # Generate versioned directory name: YYYYMMDD_HHMMSS_COMMITSHA (inside web-static)
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    VERSION_SUFFIX="${COMMIT_SHA:-latest}"
    DEPLOY_DIR="${STATIC_DIR}/${TIMESTAMP}_${VERSION_SUFFIX}"
    SYMLINK="${STATIC_DIR}/current"
    
    echo "[deploy] Deploying to versioned directory: ${DEPLOY_DIR}"
    
    # Handle first-time deployment: if web-static has files but no current symlink, preserve them
    if [ -d "${STATIC_DIR}" ] && [ ! -L "${SYMLINK}" ] && [ "$(ls -A ${STATIC_DIR} 2>/dev/null | grep -v '^current')" ]; then
      echo "[deploy] Converting existing web-static directory to versioned deployment..."
      # If web-static has files but no current symlink, move contents to initial version
      FIRST_VERSION="${STATIC_DIR}/${TIMESTAMP}_initial"
      mkdir -p "${FIRST_VERSION}"
      # Move all files/dirs except versioned directories (pattern: YYYYMMDD_HHMMSS_*) and current symlink
      find "${STATIC_DIR}" -maxdepth 1 -mindepth 1 ! -name "current*" ! -name ".*" ! -name "[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]_*" -exec mv {} "${FIRST_VERSION}/" \; 2>/dev/null || true
      echo "[deploy] Moved existing deployment to: ${FIRST_VERSION}"
    fi
    
    # Extract artifact to versioned directory
    mkdir -p "${DEPLOY_DIR}"
    echo "[deploy] Extracting static files to ${DEPLOY_DIR}..."
    tar -xzf "${ARTIFACT_FILE}" -C "${DEPLOY_DIR}"
    
    # Atomically swap symlink inside web-static directory
    echo "[deploy] Atomically swapping symlink to new deployment..."
    # Create new symlink pointing to versioned directory (relative path within web-static)
    ln -sfn "${TIMESTAMP}_${VERSION_SUFFIX}" "${SYMLINK}.new"
    # Atomic swap: mv is atomic on the same filesystem
    mv "${SYMLINK}.new" "${SYMLINK}"
    
    # Clean up uploaded artifact
    rm -f "${ARTIFACT_FILE}"
    
    echo "[deploy] Static web files deployed successfully"
    
    # Clean up old versioned directories (keep last 3)
    echo "[deploy] Cleaning up old versioned directories (keeping last 3)..."
    # List all versioned directories inside web-static (pattern: YYYYMMDD_HHMMSS_*), sort by modification time (newest first), skip first 3, remove rest
    find "${STATIC_DIR}" -maxdepth 1 -type d -name "[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]_*" 2>/dev/null | sort -r | tail -n +4 | xargs rm -rf 2>/dev/null || true
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
