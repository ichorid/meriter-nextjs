#!/bin/sh
# Runs in mongo:8 one-shot container; ensures rs0 exists on existing volumes (not only first initdb).
# When MONGO_ADMIN_PASSWORD is set (production), use admin auth only: unauth ping can succeed while
# replSetInitiate still requires auth. Local compose without a password uses unauth only.
set -eu

run_mongosh_unauth() {
  mongosh --host mongodb --port 27017 "$@"
}

run_mongosh_auth() {
  mongosh --host mongodb --port 27017 -u admin -p "$MONGO_ADMIN_PASSWORD" --authenticationDatabase admin "$@"
}

pick_mongosh() {
  if [ -n "${MONGO_ADMIN_PASSWORD:-}" ]; then
    if run_mongosh_auth --quiet --eval 'db.adminCommand({ ping: 1 }).ok' 2>/dev/null | grep -qx 1; then
      echo auth
      return 0
    fi
    return 1
  fi
  if run_mongosh_unauth --quiet --eval 'db.adminCommand({ ping: 1 }).ok' 2>/dev/null | grep -qx 1; then
    echo unauth
    return 0
  fi
  return 1
}

run_mongosh() {
  mode="$1"
  shift
  if [ "$mode" = "auth" ]; then
    run_mongosh_auth "$@"
  else
    run_mongosh_unauth "$@"
  fi
}

echo "mongodb-rs-init: waiting for MongoDB..."
i=0
MODE=""
while [ "$i" -lt 60 ]; do
  if MODE=$(pick_mongosh); then
    break
  fi
  i=$((i + 1))
  sleep 2
done
if [ -z "$MODE" ]; then
  echo "mongodb-rs-init: MongoDB did not become reachable (tried with and without admin auth)"
  exit 1
fi

echo "mongodb-rs-init: connection mode=$MODE"
echo "mongodb-rs-init: ensuring replica set rs0..."
run_mongosh "$MODE" --quiet --file /scripts/rs-init-every-deploy.js

echo "mongodb-rs-init: waiting for PRIMARY..."
i=0
state=""
while [ "$i" -lt 60 ]; do
  state=$(run_mongosh "$MODE" --quiet --eval '(() => { try { return rs.status().members[0].stateStr; } catch (e) { return ""; } })()' 2>/dev/null | tail -n 1 | tr -d '\r')
  if [ "$state" = "PRIMARY" ]; then
    echo "mongodb-rs-init: done (PRIMARY)"
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo "mongodb-rs-init: timeout waiting for PRIMARY (last state: ${state:-unknown})"
exit 1
