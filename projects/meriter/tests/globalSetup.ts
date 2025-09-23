import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

module.exports = async () => {
  const mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();
  (global as any).__MONGO_URI__ = mongoUri;
  (global as any).__MONGO_INSTANCE__ = mongo;

  await mongoose.connect(mongoUri);
};
