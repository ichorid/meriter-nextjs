import { MongoMemoryServer } from 'mongodb-memory-server';

module.exports = async () => {
  const mongo = (global as any).__MONGO_INSTANCE__ as MongoMemoryServer;
  if (mongo) {
    await mongo.stop();
  }
};
