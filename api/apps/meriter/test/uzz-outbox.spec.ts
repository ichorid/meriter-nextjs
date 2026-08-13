import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, createConnection } from 'mongoose';
import { Clock } from '../src/application/uzz/ports/clock.port';
import { UzzNotificationPayload, UzzNotificationSender } from '../src/application/uzz/ports/uzz-notification-sender.port';
import { DeliverUzzOutboxUseCase } from '../src/application/uzz/use-cases/deliver-uzz-outbox.use-case';
import { initializeUzzModels } from '../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';
import { MongooseUzzUnitOfWork } from '../src/infrastructure/uzz/persistence/mongoose-uzz-unit-of-work';
import { createMongoMemoryReplSetWithRetry } from './mongo-memory-shared';
import { unregisterReplSet } from './mongo-memory-registry.js';

const NOW = new Date('2026-08-14T00:00:00.000Z');

class FixedClock implements Clock { now() { return new Date(NOW); } }
class FakeSender implements UzzNotificationSender {
  readonly calls: Array<{ eventId: string; payload: UzzNotificationPayload }> = [];
  failure: Error | null = null;
  async send(eventId: string, payload: UzzNotificationPayload) {
    this.calls.push({ eventId, payload });
    if (this.failure) throw this.failure;
  }
}

describe('UZZ notification outbox', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let rawDb: NonNullable<Connection['db']>;
  let uow: MongooseUzzUnitOfWork;
  let sender: FakeSender;
  let deliver: DeliverUzzOutboxUseCase;

  beforeAll(async () => {
    replSet = await createMongoMemoryReplSetWithRetry();
    connection = await createConnection(replSet.getUri()).asPromise();
    if (!connection.db) throw new Error('Mongo database unavailable');
    rawDb = connection.db;
    await initializeUzzModels(connection);
    await Promise.all(Object.values(connection.models).map((model) => model.init()));
    uow = new MongooseUzzUnitOfWork(connection);
  });
  beforeEach(async () => {
    sender = new FakeSender();
    deliver = new DeliverUzzOutboxUseCase(uow, sender, new FixedClock(), {
      maximumAttempts: 3, leaseMs: 60_000,
    });
    await seedEvent();
  });
  afterEach(async () => {
    const collections = await rawDb.listCollections().toArray();
    await Promise.all(collections.map(({ name }) => rawDb.collection(name).deleteMany({})));
  });
  afterAll(async () => {
    await connection.close();
    unregisterReplSet(replSet);
    await replSet.stop();
  });

  it('marks a delivered event processed', async () => {
    expect(await deliver.executeBatch({ limit: 10 })).toEqual({ delivered: 1, failed: 0, deadLettered: 0 });
    expect(sender.calls).toHaveLength(1);
    expect(sender.calls[0]).toMatchObject({
      eventId: 'event-1', payload: { telegramUserId: '1001', text: 'Hello' },
    });
    expect(await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' }))
      .toMatchObject({ attempts: 1, processedAt: NOW, lastError: null });
  });

  it('schedules retry without losing the event when delivery fails', async () => {
    sender.failure = new Error('telegram unavailable');
    expect(await deliver.executeBatch({ limit: 10 })).toEqual({ delivered: 0, failed: 1, deadLettered: 0 });
    const event = await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' });
    expect(event).toMatchObject({ attempts: 1, processedAt: null, lastError: 'telegram unavailable' });
    expect(event?.availableAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('moves a repeatedly failing event to dead letter visibility', async () => {
    await rawDb.collection('uzz_outbox').updateOne({ id: 'event-1' }, { $set: { attempts: 2 } });
    sender.failure = new Error('permanent failure');
    expect(await deliver.executeBatch({ limit: 10 })).toEqual({ delivered: 0, failed: 1, deadLettered: 1 });
    expect(await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' }))
      .toMatchObject({ attempts: 3, processedAt: null, deadLetteredAt: NOW });
  });

  async function seedEvent() {
    await uow.run((repositories) => repositories.outbox.append({
      id: 'event-1', topic: 'uzz.telegram', aggregateId: 'deal-1',
      payload: { telegramUserId: '1001', text: 'Hello' }, attempts: 0,
      availableAt: NOW, processedAt: null, lockedUntil: null, deadLetteredAt: null,
      lastError: null, createdAt: NOW,
    }));
  }
});
