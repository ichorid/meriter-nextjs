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
    
    # Generate versioned directory name: web/out.YYYYMMDD_HHMMSS_COMMITSHA
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    VERSION_SUFFIX="${COMMIT_SHA:-latest}"
    DEPLOY_DIR="web/out.${TIMESTAMP}_${VERSION_SUFFIX}"
    SYMLINK="web/out"
    
    echo "[deploy] Deploying to versioned directory: ${DEPLOY_DIR}"
    
    # Handle first-time deployment: if web/out exists as directory, convert to versioned directory
    if [ -d "$SYMLINK" ] && [ ! -L "$SYMLINK" ]; then
      echo "[deploy] Converting existing directory to versioned deployment..."
      # Move existing directory contents to first versioned directory
      FIRST_VERSION="web/out.${TIMESTAMP}_initial"
      mv "$SYMLINK" "$FIRST_VERSION"
      echo "[deploy] Moved existing deployment to: ${FIRST_VERSION}"
    fi
    
    # Extract artifact to versioned directory
    mkdir -p "${DEPLOY_DIR}"
    echo "[deploy] Extracting static files to ${DEPLOY_DIR}..."
    tar -xzf "${ARTIFACT_FILE}" -C "${DEPLOY_DIR}"
    
    # Atomically swap symlink
    echo "[deploy] Atomically swapping symlink to new deployment..."
    # Create new symlink pointing to versioned directory
    ln -sfn "${DEPLOY_DIR}" "${SYMLINK}.new"
    # Atomic swap: mv is atomic on the same filesystem
    mv "${SYMLINK}.new" "${SYMLINK}"
    
    # Clean up uploaded artifact
    rm -f "${ARTIFACT_FILE}"
    
    echo "[deploy] Static web files deployed successfully"
    
    # Clean up old versioned directories (keep last 3)
    echo "[deploy] Cleaning up old versioned directories (keeping last 3)..."
    # List all versioned directories (type d excludes symlink), sort by modification time (newest first), skip first 3, remove rest
    ls -dt web/out.*/ 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true
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
