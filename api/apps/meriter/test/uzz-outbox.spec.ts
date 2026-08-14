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
const PAYLOAD_SECRET = 'payload-secret-do-not-persist';
const RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000] as const;

class FixedClock implements Clock {
  constructor(private current: Date = NOW) {}
  now() {
    return new Date(this.current);
  }
  set(next: Date) {
    this.current = new Date(next);
  }
}

class FakeSender implements UzzNotificationSender {
  readonly calls: Array<{ eventId: string; payload: UzzNotificationPayload }> = [];
  failure: Error | null = null;
  async send(eventId: string, payload: UzzNotificationPayload) {
    this.calls.push({ eventId, payload });
    if (this.failure) throw this.failure;
  }
}

class GateSender implements UzzNotificationSender {
  readonly calls: Array<{ eventId: string; payload: UzzNotificationPayload }> = [];
  failure: Error | null = null;
  private resolveStarted!: () => void;
  private resolveGate!: () => void;
  readonly started = new Promise<void>((resolve) => {
    this.resolveStarted = resolve;
  });
  private readonly gate = new Promise<void>((resolve) => {
    this.resolveGate = resolve;
  });
  async send(eventId: string, payload: UzzNotificationPayload) {
    this.calls.push({ eventId, payload });
    this.resolveStarted();
    await this.gate;
    if (this.failure) throw this.failure;
  }
  release() {
    this.resolveGate();
  }
}

describe('UZZ notification outbox', () => {
  jest.setTimeout(60_000);
  let replSet: MongoMemoryReplSet;
  let connection: Connection;
  let rawDb: NonNullable<Connection['db']>;
  let uow: MongooseUzzUnitOfWork;
  let sender: FakeSender;
  let clock: FixedClock;
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
    clock = new FixedClock();
    deliver = new DeliverUzzOutboxUseCase(uow, sender, clock, {
      maximumAttempts: 6, leaseMs: 60_000,
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

  it('V: keeps committed business state after notification failure', async () => {
    await rawDb.collection('uzz_deals').insertOne({
      id: 'deal-1', status: 'requested', version: 0, createdAt: NOW, updatedAt: NOW,
    });
    sender.failure = new Error('telegram unavailable');
    expect(await deliver.executeBatch({ limit: 10 })).toEqual({ delivered: 0, failed: 1, deadLettered: 0 });
    const event = await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' });
    expect(event).toMatchObject({ attempts: 1, processedAt: null });
    expect(event?.lastError).toMatch(/^Error: telegram unavailable$/);
    expect(event?.availableAt.getTime()).toBe(NOW.getTime() + RETRY_DELAYS_MS[0]);
    expect(await rawDb.collection('uzz_deals').findOne({ id: 'deal-1' }))
      .toMatchObject({ status: 'requested', version: 0 });
  });

  it('moves the sixth failed attempt to dead letter visibility', async () => {
    await rawDb.collection('uzz_outbox').updateOne({ id: 'event-1' }, { $set: { attempts: 5 } });
    sender.failure = new Error('permanent failure');
    expect(await deliver.executeBatch({ limit: 10 })).toEqual({ delivered: 0, failed: 1, deadLettered: 1 });
    expect(await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' }))
      .toMatchObject({ attempts: 6, processedAt: null, deadLetteredAt: NOW });
  });

  it('uses the fixed retry delays and dead-letters on the sixth failure', async () => {
    sender.failure = new Error('retry me');
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
      expect(await deliver.executeBatch({ limit: 10 })).toEqual({
        delivered: 0, failed: 1, deadLettered: 0,
      });
      const event = await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' });
      expect(event?.deadLetteredAt).toBeNull();
      expect(event?.availableAt.getTime()).toBe(NOW.getTime() + RETRY_DELAYS_MS[attempt]);
      await rawDb.collection('uzz_outbox').updateOne(
        { id: 'event-1' },
        { $set: { availableAt: NOW, lockedUntil: null } },
      );
    }
    expect(await deliver.executeBatch({ limit: 10 })).toEqual({
      delivered: 0, failed: 1, deadLettered: 1,
    });
    expect(await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' }))
      .toMatchObject({ attempts: 6, processedAt: null, deadLetteredAt: NOW });
  });

  it('persists a sanitized error class and message without payload secrets', async () => {
    await rawDb.collection('uzz_outbox').updateOne(
      { id: 'event-1' },
      { $set: { payload: { telegramUserId: '1001', text: PAYLOAD_SECRET } } },
    );
    sender.failure = new Error('telegram 401');
    await deliver.executeBatch({ limit: 10 });
    const event = await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' });
    expect(event?.lastError).toBe('Error: telegram 401');
    expect(event?.lastError).not.toContain(PAYLOAD_SECRET);
    expect(JSON.stringify(event?.payload)).toContain(PAYLOAD_SECRET);
  });

  it('renews the lease during a slow send so a second worker cannot claim', async () => {
    const leaseMs = 300;
    const slow = new GateSender();
    const other = new FakeSender();
    const workerA = new DeliverUzzOutboxUseCase(uow, slow, clock, { maximumAttempts: 6, leaseMs });
    const workerB = new DeliverUzzOutboxUseCase(uow, other, clock, { maximumAttempts: 6, leaseMs });

    const running = workerA.executeBatch({ limit: 10 });
    await slow.started;
    const original = await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' });
    const originalLeaseUntil = original?.lockedUntil as Date;

    clock.set(new Date(NOW.getTime() + leaseMs + 50));
    await sleep(Math.floor(leaseMs / 3) + 80);

    expect(await workerB.executeBatch({ limit: 10 })).toEqual({
      delivered: 0, failed: 0, deadLettered: 0,
    });
    expect(other.calls).toHaveLength(0);
    const renewed = await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' });
    expect((renewed?.lockedUntil as Date).getTime()).toBeGreaterThan(originalLeaseUntil.getTime());

    slow.release();
    await expect(running).resolves.toEqual({ delivered: 1, failed: 0, deadLettered: 0 });
    expect(slow.calls).toHaveLength(1);
  });

  it('ignores an old lease token after a new claim marks processed or failed', async () => {
    const [first] = await uow.run((repositories) => repositories.outbox.claimAvailable(
      NOW, 1, new Date(NOW.getTime() + 60_000), 'worker-a',
    ));
    expect(first.leaseToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const [second] = await uow.run((repositories) => repositories.outbox.claimAvailable(
      new Date(NOW.getTime() + 120_000), 1, new Date(NOW.getTime() + 180_000), 'worker-b',
    ));
    expect(second.leaseToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second.leaseToken).not.toBe(first.leaseToken);
    expect(second.leaseOwner).toBe('worker-b');

    expect(await uow.run((repositories) => repositories.outbox.markProcessed(
      first.id, first.leaseToken as string, NOW,
    ))).toBe(false);
    expect(await uow.run((repositories) => repositories.outbox.markFailed({
      id: first.id,
      leaseToken: first.leaseToken as string,
      error: 'Error: stale worker',
      availableAt: NOW,
      deadLetteredAt: NOW,
    }))).toBe(false);

    const stolen = await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' });
    expect(stolen?.processedAt).toBeNull();
    expect(stolen?.deadLetteredAt).toBeNull();
    expect(stolen?.leaseToken).toBe(second.leaseToken);

    expect(await uow.run((repositories) => repositories.outbox.markProcessed(
      second.id, second.leaseToken as string, NOW,
    ))).toBe(true);
    expect(await rawDb.collection('uzz_outbox').findOne({ id: 'event-1' }))
      .toMatchObject({ processedAt: NOW, leaseToken: second.leaseToken });
  });

  it('duplicates after a crash between Telegram send and outbox ack (at-least-once window)', async () => {
    const [claimed] = await uow.run((repositories) => repositories.outbox.claimAvailable(
      NOW, 1, new Date(NOW.getTime() + 60_000), 'worker-crash',
    ));
    await sender.send(claimed.id, {
      telegramUserId: String(claimed.payload.telegramUserId),
      text: String(claimed.payload.text),
    });
    // Crash before markProcessed: lease expires, another worker delivers again.
    clock.set(new Date(NOW.getTime() + 120_000));
    expect(await deliver.executeBatch({ limit: 10 })).toEqual({
      delivered: 1, failed: 0, deadLettered: 0,
    });
    expect(sender.calls).toHaveLength(2);
  });

  async function seedEvent() {
    await uow.run((repositories) => repositories.outbox.append({
      id: 'event-1', topic: 'uzz.telegram', aggregateId: 'deal-1',
      payload: { telegramUserId: '1001', text: 'Hello' }, attempts: 0,
      availableAt: NOW, processedAt: null, lockedUntil: null, deadLetteredAt: null,
      lastError: null, leaseToken: null, leaseOwner: null, createdAt: NOW,
    }));
  }
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
