const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Wrap MongoMemoryServer.create() with a timeout to prevent hanging in CI/CD
  const createPromise = MongoMemoryServer.create({
    binary: {
      downloadDir: process.env.MONGOMS_DOWNLOAD_DIR,
    },
    instance: {
      dbName: 'test',
    },
  });

  let timeoutId;
  const timeoutMs = process.env.CI ? 120000 : 30000;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `MongoMemoryServer.create() timed out after ${Math.round(timeoutMs / 1000)} seconds in global setup. This may indicate network issues or insufficient resources in CI/CD.`,
        ),
      );
    }, timeoutMs);
  });

  let mongod;
  try {
    mongod = await Promise.race([createPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
  const uri = mongod.getUri();
  global.__MONGOD__ = mongod;
  process.env.MONGO_URL = uri;
};
