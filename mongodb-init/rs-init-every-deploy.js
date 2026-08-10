// Idempotent replica set init — runs on every deploy via mongodb-rs-init service.
// Sole replica-set init path (initdb.d no longer runs rs.initiate — it fails during first boot).
// rs0, single member mongodb:27017. Needed when data volume existed before replSet was configured.

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
