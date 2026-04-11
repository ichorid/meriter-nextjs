#!/bin/sh
# Runs before the official mongo docker-entrypoint. Ensures replica set + auth
# have a keyFile (MongoDB requires it when authorization is enabled with --replSet).
# Priority: MONGO_REPLICA_KEYFILE_CONTENT (e.g. from .env on VPS) > existing file
# in named volume > auto-generated key persisted in that volume (never printed).
set -eu

KEYDIR=/var/lib/mongo-rs-key
KEYFILE="$KEYDIR/mongo-rs.key"

mkdir -p "$KEYDIR"

if [ -n "${MONGO_REPLICA_KEYFILE_CONTENT:-}" ]; then
  printf '%s\n' "$MONGO_REPLICA_KEYFILE_CONTENT" > "$KEYFILE.tmp"
  mv -f "$KEYFILE.tmp" "$KEYFILE"
elif [ -s "$KEYFILE" ]; then
  :
else
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 756 | tr -d '\n\r' > "$KEYFILE.tmp"
  else
    head -c 756 /dev/urandom | base64 | tr -d '\n\r' > "$KEYFILE.tmp"
  fi
  mv -f "$KEYFILE.tmp" "$KEYFILE"
fi

chmod 400 "$KEYFILE"
if id mongodb >/dev/null 2>&1; then
  chown mongodb:mongodb "$KEYFILE" || true
fi

if [ -x /usr/local/bin/docker-entrypoint.sh ]; then
  exec /usr/local/bin/docker-entrypoint.sh "$@"
fi
exec docker-entrypoint.sh "$@"
