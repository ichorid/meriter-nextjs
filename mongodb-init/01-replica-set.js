// Single-node replica set — required for multi-document transactions (e.g. merit transfer).
// Runs during Docker first-time init (empty data volume), before user creation in init-mongo.js.
// For existing volumes, see mongodb-rs-init service + rs-init-every-deploy.js (same rs0 config).
// Member host must match the Docker Compose service name so other containers can reach PRIMARY.

(function initReplicaSet() {
  const cfg = {
    _id: 'rs0',
    members: [{ _id: 0, host: 'mongodb:27017' }],
  };
  try {
    const st = rs.status();
    if (st.ok === 1) {
      print('Replica set already initialized (' + st.set + ')');
      return;
    }
  } catch (e) {
    // Not initialized — proceed.
  }
  const res = rs.initiate(cfg);
  print('rs.initiate: ' + JSON.stringify(res));
})();
