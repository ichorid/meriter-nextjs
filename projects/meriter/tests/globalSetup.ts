import { MongoMemoryServer } from 'mongodb-memory-server';

module.exports = async () => {
  const mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();
  process.env.DATABASE_URL = mongoUri;
  (global as any).__MONGO_INSTANCE__ = mongo;
};
