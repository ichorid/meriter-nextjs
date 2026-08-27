import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

type MongoClient = import('mongodb').MongoClient;
type Db = import('mongodb').Db;

export const DEFAULT_UZZ_E2E_COMMUNITY_ID =
  process.env.UZZ_E2E_COMMUNITY_ID ?? 'a1000001-0000-4000-8000-000000000001';

export type SeededUser = {
  id: string;
  email: string;
  displayName: string;
};

export type SeededCommunity = {
  id: string;
  name: string;
};

export type SeededListing = {
  id: string;
  title: string;
  communityId: string;
  authorId: string;
};

export type SeededRight = {
  id: string;
  ownerId: string;
  communityId: string;
  nominalRub: number;
};

type TrackedDoc = { collection: string; id: string };

function apiRequire() {
  const candidates = [
    join(process.cwd(), 'package.json'),
    join(process.cwd(), 'api', 'package.json'),
    join(process.cwd(), '..', 'api', 'package.json'),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const req = createRequire(candidate);
      req.resolve('mongodb');
      return req;
    } catch {
      continue;
    }
  }
  throw new Error('Cannot resolve mongodb from workspace package.json files');
}

function unwrapConstructor(value: unknown, depth = 0): unknown {
  if (typeof value === 'function') return value;
  if (!value || typeof value !== 'object' || depth > 4) return value;
  const record = value as Record<string, unknown>;
  if ('MongoClient' in record) return unwrapConstructor(record.MongoClient, depth + 1);
  if ('default' in record) return unwrapConstructor(record.default, depth + 1);
  return value;
}

function loadMongoClient() {
  const driver = apiRequire()('mongodb');
  const candidate = unwrapConstructor(driver);
  if (typeof candidate !== 'function') {
    throw new Error(
      `mongodb.MongoClient is not a constructor (got ${typeof candidate}; keys=${Object.keys(driver as object).join(',')})`,
    );
  }
  return candidate as new (url: string) => {
    connect(): Promise<unknown>;
    db(): {
      collection(name: string): {
        insertOne(doc: object): Promise<unknown>;
        updateOne(filter: object, update: object, options?: object): Promise<unknown>;
        deleteMany(filter: object): Promise<unknown>;
      };
    };
    close(): Promise<void>;
  };
}

const MongoClient = loadMongoClient();

export class UzzSeedFactory {
  private readonly tracked: TrackedDoc[] = [];
  private seq = 0;

  constructor(
    private readonly db: Db,
    private readonly client: MongoClient,
    readonly runId: string,
    readonly communityId: string,
  ) {}

  private nextId(_kind?: string): string {
    this.seq += 1;
    return randomUUID();
  }

  private track(collection: string, id: string): void {
    this.tracked.push({ collection, id });
  }

  async seedUser(input: {
    email?: string;
    displayName?: string;
    telegramUserId?: string;
    telegramUsername?: string;
  } = {}): Promise<SeededUser> {
    const now = new Date();
    const id = this.nextId('user');
    const email = (
      input.email ?? `user-${this.seq}-${this.runId}@uzz.example.test`
    ).toLowerCase();
    const displayName = input.displayName ?? 'Участник пилота';
    await this.db.collection('users').insertOne({
      id,
      authProvider: 'email',
      authId: email,
      displayName,
      profile: {},
      communityTags: [],
      communityMemberships: [this.communityId],
      createdAt: now,
      updatedAt: now,
    });
    this.track('users', id);
    await this.seedCommunity();
    await this.db.collection('communities').updateOne(
      { id: this.communityId },
      { $addToSet: { members: id } },
    );
    const identityId = this.nextId('identity');
    await this.db.collection('uzz_identities').insertOne({
      id: identityId,
      canonicalUserId: id,
      normalizedEmail: email,
      telegramUserId: input.telegramUserId ?? null,
      telegramUsername: input.telegramUsername ?? null,
      version: 0,
      createdAt: now,
      updatedAt: now,
      runId: this.runId,
    });
    this.track('uzz_identities', identityId);
    const roleId = this.nextId('role');
    await this.db.collection('user_community_roles').insertOne({
      id: roleId,
      userId: id,
      communityId: this.communityId,
      role: 'participant',
      membershipStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
    this.track('user_community_roles', roleId);
    const authIdentityId = this.nextId('auth-identity');
    await this.db.collection('user_auth_identities').insertOne({
      id: authIdentityId,
      userId: id,
      provider: 'email',
      authId: email,
      linkedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    this.track('user_auth_identities', authIdentityId);
    await this.db.collection('communities').updateOne(
      { id: this.communityId },
      {
        $addToSet: { members: id },
        $setOnInsert: {
          id: this.communityId,
          name: 'Пилот',
          hashtags: ['пилот'],
          isActive: true,
          isPriority: false,
          settings: {
            currencyNames: { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' },
            dailyEmission: 10,
          },
          createdAt: now,
          updatedAt: now,
          runId: this.runId,
        },
      },
      { upsert: true },
    );
    this.track('communities', this.communityId);
    return { id, email, displayName };
  }

  async seedCommunity(input: { name?: string; id?: string } = {}): Promise<SeededCommunity> {
    const now = new Date();
    const id = input.id ?? this.communityId;
    const name = input.name ?? 'Пилот';
    await this.db.collection('communities').updateOne(
      { id },
      {
        $setOnInsert: {
          id,
          name,
          members: [] as string[],
          hashtags: ['пилот'],
          isActive: true,
          isPriority: false,
          settings: {
            currencyNames: { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' },
            dailyEmission: 10,
          },
          createdAt: now,
          updatedAt: now,
          runId: this.runId,
        },
      },
      { upsert: true },
    );
    this.track('communities', id);
    await this.db.collection('uzz_settings').updateOne(
      { communityId: id },
      {
        $setOnInsert: {
          communityId: id,
          emissionThreshold: 10,
          initialHops: 10,
          demurrageRubPerDay: 100,
          nominalFloorRub: 100,
          defaultNominalRub: 100,
          autoAssignNominal: false,
          minimumListingsToBuy: 3,
          purchaseGateMode: 'nudge',
          requestTtlHours: 48,
          fulfillmentTtlDays: 7,
          confirmationTtlDays: 7,
          notifyRightEmitted: true,
          notifyRequestLifecycle: true,
          notifyDealProgress: true,
          notifyDealClosed: true,
          groupAnnounceRightEmitted: true,
          groupAnnounceDealClosed: true,
          version: 0,
          createdAt: now,
          updatedAt: now,
          runId: this.runId,
        },
      },
      { upsert: true },
    );
    this.track('uzz_settings', id);
    return { id, name };
  }

  async seedRight(input: {
    ownerId: string;
    nominalRub?: number;
    hopsLeft?: number;
  }): Promise<SeededRight> {
    const now = new Date();
    const id = this.nextId('right');
    const nominalRub = input.nominalRub ?? 1000;
    await this.db.collection('uzz_rights').insertOne({
      id,
      communityId: this.communityId,
      ownerId: input.ownerId,
      sourcePublicationId: this.nextId('publication'),
      nominalRub,
      nominalAssignedAt: now,
      lastDemurrageAt: now,
      hopsLeft: input.hopsLeft ?? 10,
      status: 'active',
      lockedByDealId: null,
      ownerHistory: [],
      version: 0,
      createdAt: now,
      updatedAt: now,
      runId: this.runId,
    });
    this.track('uzz_rights', id);
    return { id, ownerId: input.ownerId, communityId: this.communityId, nominalRub };
  }

  async listing(input: {
    title?: string;
    authorId?: string;
    priceRub?: number;
    description?: string;
    deliveryMode?: 'online' | 'offline' | 'both';
  } = {}): Promise<SeededListing> {
    const now = new Date();
    const author = input.authorId
      ? { id: input.authorId }
      : await this.seedUser({ displayName: 'Анна' });
    await this.seedCommunity();
    const id = this.nextId('listing');
    const title = input.title ?? 'Помощь с переездом';
    await this.db.collection('uzz_listings').insertOne({
      id,
      communityId: this.communityId,
      authorId: author.id,
      title,
      description: input.description ?? 'Помогу упаковать вещи',
      priceRub: input.priceRub ?? 500,
      deliveryMode: input.deliveryMode ?? 'offline',
      locationText: 'у вас дома',
      durationText: '2 часа',
      availabilityText: 'вечером',
      active: true,
      version: 0,
      createdAt: now,
      updatedAt: now,
      runId: this.runId,
    });
    this.track('uzz_listings', id);
    return { id, title, communityId: this.communityId, authorId: author.id };
  }

  async cleanup(): Promise<void> {
    const byCollection = new Map<string, string[]>();
    for (const doc of this.tracked) {
      const ids = byCollection.get(doc.collection) ?? [];
      ids.push(doc.id);
      byCollection.set(doc.collection, ids);
    }
    await Promise.all(
      [...byCollection.entries()].map(([collection, ids]) => {
        if (collection === 'uzz_settings') {
          return this.db.collection(collection).deleteMany({
            communityId: { $in: ids },
            runId: this.runId,
          });
        }
        if (collection === 'communities') {
          const memberIds = byCollection.get('users') ?? [];
          return Promise.all([
            this.db.collection(collection).updateMany(
              { id: { $in: ids } },
              { $pull: { members: { $in: memberIds } } },
            ),
            this.db.collection(collection).deleteMany({
              id: { $in: ids },
              runId: this.runId,
            }),
          ]);
        }
        return this.db.collection(collection).deleteMany({ id: { $in: ids } });
      }),
    );
    this.tracked.length = 0;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export async function connectUzzSeedFactory(options?: {
  mongoUrl?: string;
  runId?: string;
  communityId?: string;
}): Promise<UzzSeedFactory> {
  const mongoUrl =
    options?.mongoUrl ??
    process.env.UZZ_E2E_MONGO_URL ??
    'mongodb://127.0.0.1:27018/uzz_e2e?directConnection=true';
  const client = new MongoClient(mongoUrl);
  await client.connect();
  return new UzzSeedFactory(
    client.db(),
    client,
    options?.runId ?? randomUUID(),
    options?.communityId ?? DEFAULT_UZZ_E2E_COMMUNITY_ID,
  );
}

export async function seedUser(
  factory: UzzSeedFactory,
  input?: Parameters<UzzSeedFactory['seedUser']>[0],
): Promise<SeededUser> {
  return factory.seedUser(input);
}

export async function seedCommunity(
  factory: UzzSeedFactory,
  input?: Parameters<UzzSeedFactory['seedCommunity']>[0],
): Promise<SeededCommunity> {
  return factory.seedCommunity(input);
}

export async function seedRight(
  factory: UzzSeedFactory,
  input: Parameters<UzzSeedFactory['seedRight']>[0],
): Promise<SeededRight> {
  return factory.seedRight(input);
}
