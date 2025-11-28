#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[deploy-dev] Pulling latest images..."
docker compose pull

echo "[deploy-dev] Recreating containers..."
docker compose up -d

echo "[deploy-dev] Cleaning old images..."
docker image prune -f

echo "[deploy-dev] Done."

