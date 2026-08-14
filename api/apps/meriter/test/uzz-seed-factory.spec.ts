import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { createMongoMemoryServerWithRetry } from './mongo-memory-shared';
import { unregisterServer } from './mongo-memory-registry.js';
import { connectUzzSeedFactory, type UzzSeedFactory } from './uzz-e2e/seed-factory';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUN_ID = '11111111-2222-4333-8444-555555555555';
const COMMUNITY_ID = 'a1000001-0000-4000-8000-000000000001';

describe('UZZ seed factory', () => {
  jest.setTimeout(60_000);

  let mongod: MongoMemoryServer;
  let factory: UzzSeedFactory;

  beforeAll(async () => {
    mongod = await createMongoMemoryServerWithRetry();
  });

  afterEach(async () => {
    await factory?.cleanup();
    await factory?.close();
  });

  afterAll(async () => {
    if (mongod) {
      unregisterServer(mongod);
      await mongod.stop({ doCleanup: true, force: true });
    }
  });

  async function connect(): Promise<UzzSeedFactory> {
    factory = await connectUzzSeedFactory({
      mongoUrl: mongod.getUri(),
      runId: RUN_ID,
      communityId: COMMUNITY_ID,
    });
    return factory;
  }

  it('seeds users with UUID ids and valid default emails', async () => {
    const seed = await connect();
    const user = await seed.seedUser();
    expect(user.id).toMatch(UUID_RE);
    expect(user.email).not.toContain(':');
    expect(user.email).toBe(`user-1-${RUN_ID}@uzz.example.test`);
  });

  it('tracks uzz_settings so cleanup deletes run-owned settings', async () => {
    const seed = await connect();
    await seed.seedCommunity();
    const client = new MongoClient(mongod.getUri());
    await client.connect();
    try {
      const settings = client.db().collection('uzz_settings');
      expect(await settings.countDocuments({ communityId: COMMUNITY_ID, runId: RUN_ID })).toBe(1);
      await seed.cleanup();
      expect(await settings.countDocuments({ communityId: COMMUNITY_ID, runId: RUN_ID })).toBe(0);
    } finally {
      await client.close();
    }
  });
});
