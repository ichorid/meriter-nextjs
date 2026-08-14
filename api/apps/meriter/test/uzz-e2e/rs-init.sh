#!/bin/sh
set -eu
echo "uzz-e2e mongo-rs-init: waiting for mongod"
i=0
while [ "$i" -lt 60 ]; do
  if mongosh --host mongo:27017 --quiet --eval 'db.adminCommand({ ping: 1 }).ok' >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

echo "uzz-e2e mongo-rs-init: initiating rs0"
mongosh --host mongo:27017 --quiet --eval '
  try {
    rs.status();
  } catch (e) {
    rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] });
  }
'

echo "uzz-e2e mongo-rs-init: waiting for PRIMARY"
i=0
while [ "$i" -lt 60 ]; do
  state=$(mongosh --host mongo:27017 --quiet --eval 'try { print(rs.status().members[0].stateStr) } catch (e) { print("") }' | tr -d '\r')
  if [ "$state" = "PRIMARY" ]; then
    echo "uzz-e2e mongo-rs-init: PRIMARY"
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo "uzz-e2e mongo-rs-init: timeout waiting for PRIMARY"
exit 1
