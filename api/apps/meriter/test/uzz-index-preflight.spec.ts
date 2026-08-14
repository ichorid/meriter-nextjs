import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UZZ_REQUIRED_INDEXES } from '../src/infrastructure/uzz/persistence/uzz-index-manifest';
import {
  runUzzIndexPreflight,
  verifyUzzIndexes,
} from '../src/infrastructure/uzz/persistence/verify-uzz-indexes';
import { runVerifyUzzIndexesCli } from '../../../scripts/verify-uzz-indexes';
import { createMongoMemoryServerWithRetry } from './mongo-memory-shared';
import { unregisterServer } from './mongo-memory-registry.js';

const WRONG_COMMAND_INDEX = 'uzz_commands_actor_command_unique';

async function createRequiredIndexes(db: Db) {
  for (const index of UZZ_REQUIRED_INDEXES) {
    await db.collection(index.collection).createIndex(index.key, {
      name: index.name,
      ...(index.unique ? { unique: true } : {}),
      ...(index.expireAfterSeconds !== undefined
        ? { expireAfterSeconds: index.expireAfterSeconds }
        : {}),
      ...(index.partialFilterExpression
        ? { partialFilterExpression: index.partialFilterExpression }
        : {}),
    });
  }
}

describe('UZZ required index preflight', () => {
  jest.setTimeout(120_000);

  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    mongod = await createMongoMemoryServerWithRetry();
    client = await MongoClient.connect(mongod.getUri());
    db = client.db('uzz-index-preflight');
  });

  afterEach(async () => {
    const collections = await db.collections();
    await Promise.all(collections.map((collection) => collection.drop()));
  });

  afterAll(async () => {
    await client?.close();
    if (mongod) {
      unregisterServer(mongod);
      await mongod.stop({ doCleanup: true, force: true });
    }
  });

  it('reports collection, index, expected and actual keys/options for a same-name wrong-key index and exits non-zero', async () => {
    await db.collection('uzz_commands').createIndex(
      { commandId: 1 },
      { unique: true, name: WRONG_COMMAND_INDEX },
    );

    const result = await verifyUzzIndexes(db, 'verify');
    const mismatch = result.mismatches.find(
      (entry) => entry.index === WRONG_COMMAND_INDEX,
    );

    expect(result.ok).toBe(false);
    expect(mismatch).toEqual({
      collection: 'uzz_commands',
      index: WRONG_COMMAND_INDEX,
      expected: {
        key: { actorId: 1, commandId: 1 },
        options: { unique: true },
      },
      actual: {
        key: { commandId: 1 },
        options: { unique: true },
      },
    });

    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(runVerifyUzzIndexesCli(db)).resolves.toBe(1);
    } finally {
      error.mockRestore();
    }
  });

  it('passes when every required index matches the manifest exactly', async () => {
    await createRequiredIndexes(db);

    const result = await verifyUzzIndexes(db, 'verify');

    expect(result.ok).toBe(true);
    expect(result.mismatches).toEqual([]);
    await expect(runVerifyUzzIndexesCli(db)).resolves.toBe(0);
  });

  it('never creates or drops indexes in verify mode', async () => {
    await db.collection('uzz_commands').createIndex(
      { commandId: 1 },
      { unique: true, name: WRONG_COMMAND_INDEX },
    );
    const before = await db.collection('uzz_commands').indexes();

    await verifyUzzIndexes(db, 'verify');

    expect(await db.collection('uzz_commands').indexes()).toEqual(before);
    expect(
      (await db.listCollections({ name: 'uzz_rate_limits' }).toArray()).length,
    ).toBe(0);
  });

  it('includes identity, open-deal/right, ledger, command, outbox, and rate-limit indexes', () => {
    const names = UZZ_REQUIRED_INDEXES.map((index) => index.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'uzz_identities_id_unique',
        'uzz_identities_canonical_user_unique',
        'uzz_identities_email_unique',
        'uzz_identities_telegram_user_unique',
        'uzz_identity_aliases_user_unique',
        'uzz_identity_tokens_hash_unique',
        'uzz_deals_v2_one_open_per_right',
        'uzz_rights_deal_lock_unique',
        'uzz_ledger_operation_user_type_unique',
        'uzz_commands_actor_command_unique',
        'uzz_outbox_id_unique',
        'processedAt_1_availableAt_1',
        'deadLetteredAt_1_lockedUntil_1_availableAt_1',
        'uzz_rate_limits_scope_subject_window_unique',
        'uzz_rate_limits_expires_ttl',
      ]),
    );
    expect(
      UZZ_REQUIRED_INDEXES.find((index) => index.name === 'uzz_deals_v2_one_open_per_right')
        ?.partialFilterExpression,
    ).toEqual({
      exchangeRightId: { $type: 'string' },
      status: { $in: ['requested', 'accepted', 'completed_by_seller'] },
    });
    expect(
      UZZ_REQUIRED_INDEXES.find((index) => index.name === 'uzz_rate_limits_expires_ttl'),
    ).toMatchObject({ expireAfterSeconds: 0 });
  });

  it('fails production startup on incompatible indexes unless the emergency skip is set', async () => {
    const logger = { error: jest.fn() };

    await expect(
      runUzzIndexPreflight(db, { NODE_ENV: 'production' }, logger),
    ).rejects.toThrow(/uzz_commands_actor_command_unique/);
    expect(logger.error).not.toHaveBeenCalled();

    await expect(
      runUzzIndexPreflight(
        db,
        { NODE_ENV: 'production', UZZ_SKIP_INDEX_PREFLIGHT: 'true' },
        logger,
      ),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/UZZ_SKIP_INDEX_PREFLIGHT=true/),
    );
  });
});
