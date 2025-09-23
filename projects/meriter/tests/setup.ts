import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

jest.mock('next/config', () => () => ({
    publicRuntimeConfig: {
      APP_ENV: 'test',
    },
  }));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  console.log('Setting up mongo memory server...');
  mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();
  console.log(`Mongo memory server running at: ${mongoUri}`);
  await mongoose.connect(mongoUri);
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (let collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  if (mongo) {
    await mongo.stop();
  }
  await mongoose.connection.close();
});
