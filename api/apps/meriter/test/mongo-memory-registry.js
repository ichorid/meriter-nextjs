/** @typedef {import('mongodb-memory-server').MongoMemoryServer} MongoMemoryServer */
/** @typedef {import('mongodb-memory-server').MongoMemoryReplSet} MongoMemoryReplSet */

const servers = new Set();
const replSets = new Set();

let signalHandlersRegistered = false;
let stoppingAll = false;

function registerServer(mongod) {
  servers.add(mongod);
}

function unregisterServer(mongod) {
  servers.delete(mongod);
}

function registerReplSet(replSet) {
  replSets.add(replSet);
}

function unregisterReplSet(replSet) {
  replSets.delete(replSet);
}

async function stopAllRegistered(options) {
  if (stoppingAll) {
    return;
  }
  stoppingAll = true;

  const force = options?.force ?? false;
  const stopOpts = force ? { force: true } : undefined;

  const tasks = [];

  for (const mongod of servers) {
    tasks.push(
      mongod.stop(stopOpts).catch(() => {
        /* best-effort */
      }),
    );
  }
  for (const replSet of replSets) {
    tasks.push(
      replSet.stop().catch(() => {
        /* best-effort */
      }),
    );
  }

  await Promise.allSettled(tasks);
  servers.clear();
  replSets.clear();
  stoppingAll = false;
}

function registerSignalHandlers() {
  if (signalHandlersRegistered) {
    return;
  }
  signalHandlersRegistered = true;

  const onShutdown = () => {
    void stopAllRegistered({ force: true });
  };

  process.once('SIGINT', onShutdown);
  process.once('SIGTERM', onShutdown);
}

module.exports = {
  registerServer,
  unregisterServer,
  registerReplSet,
  unregisterReplSet,
  stopAllRegistered,
  registerSignalHandlers,
};
