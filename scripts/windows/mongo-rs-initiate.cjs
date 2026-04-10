/**
 * One-time replica set initiate for local MongoDB (no mongosh required).
 * Run from repo root: pnpm --filter @meriter/api exec node ../scripts/windows/mongo-rs-initiate.cjs
 */
const path = require('path');
const { createRequire } = require('module');
const apiRoot = path.join(__dirname, '..', '..', 'api');
const requireApi = createRequire(path.join(apiRoot, 'package.json'));
const { MongoClient } = requireApi('mongodb');

const uri =
  process.env.MONGO_URL?.split('?')[0] || 'mongodb://127.0.0.1:27017';

(async () => {
  // Before replSetInitiate the node is RSGhost; driver needs directConnection.
  const client = new MongoClient(uri, { directConnection: true });
  await client.connect();
  const admin = client.db('admin');
  try {
    const st = await admin.command({ replSetGetStatus: 1 });
    console.log('Replica set already initialized:', st.set);
  } catch (e) {
    const msg = String(e?.message || e);
    const code = e?.codeName || '';
    if (
      code === 'NotYetInitialized' ||
      /not yet initialized|no replset config/i.test(msg)
    ) {
      await admin.command({
        replSetInitiate: {
          _id: 'rs0',
          members: [{ _id: 0, host: '127.0.0.1:27017' }],
        },
      });
      console.log('replSetInitiate completed for rs0 / 127.0.0.1:27017');
    } else {
      console.error(e);
      process.exitCode = 1;
    }
  }
  await client.close();
})();
