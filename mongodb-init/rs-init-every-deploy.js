// Idempotent replica set init — runs on every deploy via mongodb-rs-init service.
// Matches mongodb-init/01-replica-set.js (rs0, single member mongodb:27017).
// Needed when data volume already existed before initdb.d scripts ran (e.g. remote VPS).

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
  print('rs.initiate: ' + tojson(res));
})();
