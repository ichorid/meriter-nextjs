import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import {
  CommandExecutor,
  hashCommandPayload,
} from '../src/application/uzz/use-cases/command-executor';
import { UzzConflictError } from '../src/domain/uzz/errors';
import { TransactionSchema } from '../src/domain/models/transaction/transaction.schema';
import { WalletSchema } from '../src/domain/models/wallet/wallet.schema';
import { initializeUzzModels } from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const LOCAL = 'community-1';
const GLOBAL = 'global';

describe('UZZ wallet transactions', () => {
  jest.setTimeout(60_000);

  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let rawDb: NonNullable<Connection['db']>;
  let uow: MongooseUzzUnitOfWork;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry();
    connection = await createConnection(replSet.getUri()).asPromise();
    if (!connection.db) throw new Error('Mongo database unavailable');
    rawDb = connection.db;
    connection.model('WalletUzzTest', WalletSchema);
    connection.model('TransactionUzzTest', TransactionSchema);
    await initializeUzzModels(connection);
    await Promise.all(Object.values(connection.models).map((model) => model.init()));
    uow = new MongooseUzzUnitOfWork(connection);
  });

  beforeEach(async () => {
    await seedWallet('local-wallet', LOCAL, 1);
    await seedWallet('global-wallet', GLOBAL, 1);
  });

  afterEach(async () => {
    const collections = await rawDb.listCollections().toArray();
    await Promise.all(
      collections.map(({ name }) => rawDb.collection(name).deleteMany({})),
    );
  });

  afterAll(async () => {
    await connection?.close();
    if (replSet) {
      unregisterReplSet(replSet);
      await replSet.stop();
    }
  });

  it('P: rolls back every injected economic failure', async () => {
    await expect(
      uow.run(async (repositories) => {
        await repositories.wallet.reservePreferLocal({
          userId: 'buyer-1',
          localCommunityId: LOCAL,
          globalCommunityId: GLOBAL,
          amount: 1,
          operationId: 'operation-rollback',
        });
        throw new Error('injected failure');
      }),
    ).rejects.toThrow('injected failure');

    expect(await balance(LOCAL)).toBe(1);
    expect(await balance(GLOBAL)).toBe(1);
    expect(await rawDb.collection('transactions').countDocuments()).toBe(0);
  });

  it('uses the local wallet first and global wallet only as fallback', async () => {
    const local = await uow.run((repositories) =>
      repositories.wallet.reservePreferLocal({
        userId: 'buyer-1',
        localCommunityId: LOCAL,
        globalCommunityId: GLOBAL,
        amount: 1,
        operationId: 'operation-local',
      }),
    );
    expect(local.sourceCommunityId).toBe(LOCAL);
    expect(await balance(LOCAL)).toBe(0);
    expect(await balance(GLOBAL)).toBe(1);

    const global = await uow.run((repositories) =>
      repositories.wallet.reservePreferLocal({
        userId: 'buyer-1',
        localCommunityId: LOCAL,
        globalCommunityId: GLOBAL,
        amount: 1,
        operationId: 'operation-global',
      }),
    );
    expect(global.sourceCommunityId).toBe(GLOBAL);
    expect(await balance(GLOBAL)).toBe(0);
  });

  it('returns the first result when commandId is replayed', async () => {
    const executor = new CommandExecutor(uow);
    const payload = { dealId: 'd1', amount: 1 };
    const run = () =>
      executor.execute({
        commandId: 'command-1',
        actorId: 'buyer-1',
        type: 'reserve_fee',
        payload,
        work: async (repositories) =>
          repositories.wallet.reservePreferLocal({
            userId: 'buyer-1',
            localCommunityId: LOCAL,
            globalCommunityId: GLOBAL,
            amount: 1,
            operationId: 'command-1',
          }),
      });

    const first = await run();
    const replay = await run();

    expect(replay).toEqual(first);
    expect(await balance(LOCAL)).toBe(0);
    expect(
      await rawDb
        .collection('transactions')
        .countDocuments({ referenceId: 'command-1' }),
    ).toBe(1);
  });

  it('replays when object key order differs but the canonical payload matches', async () => {
    const executor = new CommandExecutor(uow);
    const work = jest.fn(async () => ({ ok: true as const }));
    const first = await executor.execute({
      commandId: 'command-key-order',
      actorId: 'buyer-1',
      type: 'deal.close',
      payload: { dealId: 'd1', note: 'same' },
      work,
    });
    work.mockClear();
    const replay = await executor.execute({
      commandId: 'command-key-order',
      actorId: 'buyer-1',
      type: 'deal.close',
      payload: { note: 'same', dealId: 'd1' },
      work,
    });
    expect(replay).toEqual(first);
    expect(work).not.toHaveBeenCalled();
    expect(hashCommandPayload({ note: 'same', dealId: 'd1' })).toBe(
      hashCommandPayload({ dealId: 'd1', note: 'same' }),
    );
  });

  it('rejects the same command id when the payload differs', async () => {
    const executor = new CommandExecutor(uow);
    const work = async () => ({ ok: true as const });
    await executor.execute({
      commandId: 'command-conflict',
      actorId: 'a',
      type: 'deal.close',
      payload: { dealId: 'd1' },
      work,
    });
    await expect(
      executor.execute({
        commandId: 'command-conflict',
        actorId: 'a',
        type: 'deal.close',
        payload: { dealId: 'd2' },
        work,
      }),
    ).rejects.toMatchObject({ code: 'COMMAND_ID_CONFLICT' });
  });

  it('rejects the same command id when the type differs', async () => {
    const executor = new CommandExecutor(uow);
    const work = async () => ({ ok: true as const });
    await executor.execute({
      commandId: 'command-type-conflict',
      actorId: 'a',
      type: 'deal.close',
      payload: { dealId: 'd1' },
      work,
    });
    await expect(
      executor.execute({
        commandId: 'command-type-conflict',
        actorId: 'a',
        type: 'deal.cancel',
        payload: { dealId: 'd1' },
        work,
      }),
    ).rejects.toMatchObject({ code: 'COMMAND_ID_CONFLICT' });
  });

  it('does not return another actor stored result for the same command id', async () => {
    const executor = new CommandExecutor(uow);
    const first = await executor.execute({
      commandId: 'shared-command',
      actorId: 'a',
      type: 'deal.close',
      payload: { dealId: 'd1' },
      work: async () => 'actor-a',
    });
    const second = await executor.execute({
      commandId: 'shared-command',
      actorId: 'b',
      type: 'deal.close',
      payload: { dealId: 'd1' },
      work: async () => 'actor-b',
    });
    expect(first).toBe('actor-a');
    expect(second).toBe('actor-b');
  });

  it('F: refuses a request without fee balance', async () => {
    await rawDb.collection('wallets').updateMany({}, { $set: { balance: 0 } });

    await expect(
      uow.run((repositories) =>
        repositories.wallet.reservePreferLocal({
          userId: 'buyer-1',
          localCommunityId: LOCAL,
          globalCommunityId: GLOBAL,
          amount: 1,
          operationId: 'operation-insufficient',
        }),
      ),
    ).rejects.toBeInstanceOf(UzzConflictError);
    expect(await rawDb.collection('transactions').countDocuments()).toBe(0);
  });

  async function seedWallet(id: string, communityId: string, value: number) {
    await rawDb.collection('wallets').insertOne({
      id,
      userId: 'buyer-1',
      communityId,
      balance: value,
      currency: { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' },
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async function balance(communityId: string): Promise<number> {
    const row = await rawDb
      .collection('wallets')
      .findOne({ userId: 'buyer-1', communityId });
    return Number(row?.balance);
  }
});
