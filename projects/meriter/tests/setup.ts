import mongoose from 'mongoose';

jest.mock('next/config', () => () => ({
    publicRuntimeConfig: {
      APP_ENV: 'test',
    },
  }));

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not set');
  }
  process.env.JWT_SECRET = 'test-secret';
  process.env.noAxios = "true";
  await mongoose.connect(process.env.DATABASE_URL);
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (let collection of collections) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});
