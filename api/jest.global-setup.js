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

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('MongoMemoryServer.create() timed out after 30 seconds in global setup. This may indicate network issues or insufficient resources in CI/CD.'));
    }, 30000); // 30 second timeout - fail fast
  });

  const mongod = await Promise.race([createPromise, timeoutPromise]);
  const uri = mongod.getUri();
  global.__MONGOD__ = mongod;
  process.env.MONGO_URL = uri;
};
