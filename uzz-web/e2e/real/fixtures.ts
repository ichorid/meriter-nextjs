import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import {
  connectUzzSeedFactory,
  seedCommunity,
  seedRight,
  seedUser,
  type SeededListing,
  type SeededRight,
  type UzzSeedFactory,
} from '../../../api/apps/meriter/test/uzz-e2e/seed-factory';
import {
  failNextEmailSend,
  readEmailMessages,
  readLastEmail,
  resetFakeEmail,
  waitForLastEmail,
  type FakeEmailMessage,
} from '../../../api/apps/meriter/test/uzz-e2e/fake-email-provider';
import {
  delayTelegramSend,
  readTelegramMessages,
  resetFakeTelegram,
} from '../../../api/apps/meriter/test/uzz-e2e/fake-telegram-provider';
import {
  UZZ_PLATFORM_COLLECTION,
  UZZ_PLATFORM_STAND_ID,
  readSelectedCommunityId,
  writeSelectedCommunityId,
} from '../../../api/apps/meriter/src/infrastructure/uzz/persistence/uzz-platform-selection';

export {
  delayTelegramSend,
  failNextEmailSend,
  readEmailMessages,
  readLastEmail,
  readTelegramMessages,
  resetFakeEmail,
  resetFakeTelegram,
  seedCommunity,
  seedRight,
  seedUser,
  waitForLastEmail,
};

export const UZZ_SESSION_COOKIE = 'meriter_uzz_session';
export const RUNTIME_COMMUNITY_ID =
  process.env.UZZ_E2E_COMMUNITY_ID ?? 'a1000001-0000-4000-8000-000000000001';
export const GLOBAL_COMMUNITY_ID = '__global__';
export const API_REPLICA_A = process.env.UZZ_E2E_API_URL ?? 'http://127.0.0.1:8002';
export const API_REPLICA_B = process.env.UZZ_E2E_API_REPLICA_URL ?? 'http://127.0.0.1:8003';

let trpcRequestCount = 0;

export function realTrpcRequestCount(): number {
  return trpcRequestCount;
}

function isUzzTrpcUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return pathname.includes('trpc') && pathname.split('/').includes('uzz');
  } catch {
    return false;
  }
}

export type EconomicsSnapshot = {
  wallets: Array<{ id: string; userId: string; communityId: string; balance: number }>;
  rights: Array<{
    id: string;
    ownerId: string;
    status: string;
    nominalRub: number | null;
    lockedByDealId: string | null;
  }>;
  deals: Array<{ id: string; status: string; feeReserved: boolean }>;
  ledger: Array<{ id: string; type: string; amount: number; userId: string }>;
  outbox: Array<{ id: string; processedAt: Date | null; leaseToken: string | null }>;
  transactionCount: number;
};

type SeedApi = Pick<UzzSeedFactory, 'listing' | 'seedUser' | 'seedCommunity' | 'seedRight'> & {
  runId: string;
  communityId: string;
  countListings(authorId?: string): Promise<number>;
  seedWallet(input: {
    userId: string;
    communityId: string;
    balance: number;
  }): Promise<{ id: string }>;
  setSuperadmin(userId: string): Promise<void>;
  attachSharedGlobal(userIds: string[]): Promise<void>;
  listingIn(
    communityId: string,
    input?: Parameters<UzzSeedFactory['listing']>[0],
  ): Promise<SeededListing>;
  seedRightIn(
    communityId: string,
    input: Parameters<UzzSeedFactory['seedRight']>[0],
  ): Promise<SeededRight>;
  updateRightNominal(rightId: string, nominalRub: number): Promise<void>;
  insertDueDeal(input: {
    id: string;
    buyerId: string;
    sellerId: string;
    listingId: string;
    rightId: string;
    title: string;
    feeSourceCommunityId: string;
  }): Promise<{ id: string }>;
  insertOutbox(input: { telegramUserId: string; text: string }): Promise<{ id: string }>;
  snapshotEconomics(userIds: string[]): Promise<EconomicsSnapshot>;
};

export const realUzzTest = base.extend<{ seed: SeedApi }>({
  seed: async ({}, use) => {
    await resetUzzRateLimits();
    await clearIdentityFailureInjection().catch(() => undefined);
    await resetFakeEmail().catch(() => undefined);
    await resetFakeTelegram().catch(() => undefined);
    const factory = await connectUzzSeedFactory({ runId: randomUUID() });
    const startedAt = new Date(Date.now() - 1000);
    try {
      await use({
        runId: factory.runId,
        communityId: factory.communityId,
        listing: (input) => factory.listing(input),
        seedUser: (input) => factory.seedUser(input),
        seedCommunity: (input) => factory.seedCommunity(input),
        seedRight: (input) => factory.seedRight(input),
        countListings: (authorId) => countListings(factory.communityId, authorId),
        seedWallet: (input) => seedWalletDoc(factory.runId, input),
        setSuperadmin: (userId) => setSuperadmin(userId),
        attachSharedGlobal: (userIds) => attachSharedGlobal(userIds),
        listingIn: (communityId, input) => listingInCommunity(factory, communityId, input),
        seedRightIn: (communityId, input) => rightInCommunity(factory, communityId, input),
        updateRightNominal: (rightId, nominalRub) => updateRightNominal(rightId, nominalRub),
        insertDueDeal: (input) => insertDueDeal(factory.runId, factory.communityId, input),
        insertOutbox: (input) => insertOutboxEvent(factory.runId, input),
        snapshotEconomics: (userIds) => snapshotEconomics(userIds),
      });
    } finally {
      await restoreSharedGlobal().catch(() => undefined);
      await cleanupEconomicsSince(startedAt, factory.runId).catch(() => undefined);
      await factory.cleanup();
      await factory.close();
    }
  },
  page: async ({ page }, use) => {
    trpcRequestCount = 0;
    page.on('request', (request) => {
      if (isUzzTrpcUrl(request.url())) {
        trpcRequestCount += 1;
      }
    });
    await use(page);
  },
});

export function assertNoTrpcInterception(
  dir = path.join(process.cwd(), 'e2e', 'real'),
): void {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of files) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      assertNoTrpcInterception(full);
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    const source = fs.readFileSync(full, 'utf8');
    expect(source, full).not.toMatch(/page\.route\s*\(/);
    expect(source, full).not.toMatch(/\*\*\/trpc\/uzz/);
  }
}

type E2eCollection = {
  countDocuments(filter?: object): Promise<number>;
  find(filter?: object): { toArray(): Promise<Array<Record<string, unknown>>> };
  findOne(filter: object): Promise<Record<string, unknown> | null>;
  insertOne(doc: object): Promise<unknown>;
  updateOne(filter: object, update: object, options?: object): Promise<{ matchedCount: number }>;
  updateMany(filter: object, update: object): Promise<unknown>;
  deleteMany(filter: object): Promise<unknown>;
};

type E2eDb = {
  collection(name: string): E2eCollection;
  command(command: object): Promise<unknown>;
};

function mongoClientCtor() {
  const candidates = [
    path.join(process.cwd(), 'package.json'),
    path.join(process.cwd(), 'api', 'package.json'),
    path.join(process.cwd(), '..', 'api', 'package.json'),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const req = createRequire(candidate);
      const driver = req('mongodb') as { MongoClient?: unknown; default?: { MongoClient?: unknown } };
      const Client = driver.MongoClient ?? driver.default?.MongoClient;
      if (typeof Client === 'function') {
        return Client as new (url: string) => {
          connect(): Promise<unknown>;
          db(name?: string): E2eDb;
          close(): Promise<void>;
        };
      }
    } catch {
      continue;
    }
  }
  throw new Error('Cannot resolve mongodb.MongoClient');
}

const MongoClient = mongoClientCtor();

function e2eMongoUrl(): string {
  return (
    process.env.UZZ_E2E_MONGO_URL ??
    'mongodb://127.0.0.1:27018/uzz_e2e?directConnection=true'
  );
}

export async function resetUzzRateLimits(): Promise<void> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    await client.db().collection('uzz_rate_limits').deleteMany({});
  } finally {
    await client.close();
  }
}

export async function countListings(
  communityId = RUNTIME_COMMUNITY_ID,
  authorId?: string,
): Promise<number> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    const filter: Record<string, string> = { communityId };
    if (authorId) filter.authorId = authorId;
    return await client.db().collection('uzz_listings').countDocuments(filter);
  } finally {
    await client.close();
  }
}

export async function injectRetryableIdentityFailureOnce(): Promise<void> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    await client.db('admin').command({
      configureFailPoint: 'failCommand',
      mode: { times: 1 },
      data: {
        failCommands: ['find', 'findAndModify'],
        namespace: 'uzz_e2e.user_auth_identities',
        errorCode: 8,
      },
    });
  } finally {
    await client.close();
  }
}

export async function clearIdentityFailureInjection(): Promise<void> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    await client.db('admin').command({
      configureFailPoint: 'failCommand',
      mode: 'off',
    });
  } finally {
    await client.close();
  }
}

const MAGIC_LINK_RE = /https?:\/\/[^"'<\s]+\/a\/([A-Za-z0-9_-]+)/;

export function magicLinkFromEmail(email: FakeEmailMessage): { url: string; token: string } {
  const source = `${email.html}\n${email.plaintext}`;
  const match = source.match(MAGIC_LINK_RE);
  if (!match?.[0] || !match[1]) {
    throw new Error('magic link missing from fake email');
  }
  return { url: match[0], token: match[1] };
}

export function attachSecretWatch(page: Page): { secrets: string[]; assertNotLeaked(value: string): void } {
  const secrets: string[] = [];
  const record = (value: string) => {
    if (value) secrets.push(value);
  };
  page.on('console', (msg) => record(msg.text()));
  page.on('pageerror', (error) => record(error.message));
  page.on('response', (response) => {
    if (!isUzzTrpcUrl(response.url())) return;
    void response
      .text()
      .then(record)
      .catch(() => undefined);
  });
  return {
    secrets,
    assertNotLeaked(value: string) {
      const haystack = secrets.join('\n');
      expect(haystack).not.toContain(value);
    },
  };
}

export async function requestLoginLink(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Получить ссылку' }).click();
}

export async function sessionCookieNames(context: BrowserContext): Promise<string[]> {
  const cookies = await context.cookies();
  return cookies.filter((cookie) => cookie.name === UZZ_SESSION_COOKIE).map((cookie) => cookie.name);
}

export async function hasUzzSession(context: BrowserContext): Promise<boolean> {
  return (await sessionCookieNames(context)).includes(UZZ_SESSION_COOKIE);
}

export async function postUzzMutation(
  apiBase: string,
  procedure: string,
  input: unknown,
  cookieHeader?: string,
): Promise<{ status: number; body: string }> {
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/trpc/uzz/${procedure}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-meriter-product': 'uzz',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify({ json: input }),
  });
  return { status: response.status, body: await response.text() };
}

async function withE2eDb<T>(work: (db: E2eDb) => Promise<T>): Promise<T> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    return await work(client.db());
  } finally {
    await client.close();
  }
}

const WALLET_CURRENCY = {
  singular: 'заслуга',
  plural: 'заслуги',
  genitive: 'заслуг',
};

async function seedWalletDoc(
  runId: string,
  input: { userId: string; communityId: string; balance: number },
): Promise<{ id: string }> {
  const now = new Date();
  return withE2eDb(async (db) => {
    const existing = await db.collection('wallets').find({
      userId: input.userId,
      communityId: input.communityId,
    }).toArray();
    const id = existing[0] ? String(existing[0].id) : randomUUID();
    if (existing[0]) {
      await db.collection('wallets').updateOne(
        { id },
        { $set: { balance: input.balance, lastUpdated: now, updatedAt: now, runId } },
      );
      if (existing.length > 1) {
        await db.collection('wallets').deleteMany({
          userId: input.userId,
          communityId: input.communityId,
          id: { $ne: id },
        });
      }
      return { id };
    }
    await db.collection('wallets').insertOne({
      id,
      userId: input.userId,
      communityId: input.communityId,
      balance: input.balance,
      currency: WALLET_CURRENCY,
      lastUpdated: now,
      createdAt: now,
      updatedAt: now,
      runId,
    });
    return { id };
  });
}

async function setSuperadmin(userId: string): Promise<void> {
  await withE2eDb((db) =>
    db.collection('users').updateOne({ id: userId }, { $set: { globalRole: 'superadmin' } }),
  );
}

type SharedGlobalRestore = {
  telegramChatId: unknown;
  hadTelegramChatId: boolean;
  typeTag: unknown;
  hadTypeTag: boolean;
  userIds: string[];
  selectedCommunityId: string | null;
};

let sharedGlobalRestore: SharedGlobalRestore | null = null;

async function restoreSharedGlobal(): Promise<void> {
  const restore = sharedGlobalRestore;
  sharedGlobalRestore = null;
  if (!restore) return;
  const now = new Date();
  await withE2eDb(async (db) => {
    const setFields: Record<string, unknown> = { updatedAt: now };
    const unsetFields: Record<string, string> = {};
    if (restore.hadTelegramChatId) setFields.telegramChatId = restore.telegramChatId;
    else unsetFields.telegramChatId = '';
    if (restore.hadTypeTag) setFields.typeTag = restore.typeTag;
    else unsetFields.typeTag = '';
    await db.collection('communities').updateOne(
      { id: GLOBAL_COMMUNITY_ID },
      {
        $set: setFields,
        ...(Object.keys(unsetFields).length ? { $unset: unsetFields } : {}),
        $pull: { members: { $in: restore.userIds } },
      },
    );
    await db.collection('user_community_roles').deleteMany({
      userId: { $in: restore.userIds },
      communityId: GLOBAL_COMMUNITY_ID,
    });
    if (restore.selectedCommunityId) {
      await writeSelectedCommunityId(db, restore.selectedCommunityId);
    } else {
      await db.collection(UZZ_PLATFORM_COLLECTION).updateOne(
        { id: UZZ_PLATFORM_STAND_ID },
        { $unset: { selectedCommunityId: '' }, $set: { updatedAt: now } },
      );
    }
  });
}

async function attachSharedGlobal(userIds: string[]): Promise<void> {
  const now = new Date();
  await withE2eDb(async (db) => {
    const existing = await db.collection('communities').findOne({ id: GLOBAL_COMMUNITY_ID });
    sharedGlobalRestore = {
      telegramChatId: existing?.telegramChatId,
      hadTelegramChatId: Boolean(existing && Object.prototype.hasOwnProperty.call(existing, 'telegramChatId')),
      typeTag: existing?.typeTag,
      hadTypeTag: Boolean(existing && Object.prototype.hasOwnProperty.call(existing, 'typeTag')),
      userIds: [...userIds],
      selectedCommunityId: await readSelectedCommunityId(db),
    };
    // Shared wallet mode is local === global, which now follows the persisted stand community.
    await writeSelectedCommunityId(db, GLOBAL_COMMUNITY_ID);
    await db.collection('communities').updateOne(
      { id: GLOBAL_COMMUNITY_ID },
      {
        $set: {
          telegramChatId: 'e2e-shared-global',
          updatedAt: now,
        },
        $unset: { typeTag: '' },
        $addToSet: { members: { $each: userIds } },
        $setOnInsert: {
          id: GLOBAL_COMMUNITY_ID,
          name: 'Глобальное сообщество',
          hashtags: ['пилот'],
          isActive: true,
          isPriority: false,
          settings: {
            currencyNames: WALLET_CURRENCY,
            dailyEmission: 10,
          },
          createdAt: now,
        },
      },
      { upsert: true },
    );
    await db.collection('uzz_settings').updateOne(
      { communityId: GLOBAL_COMMUNITY_ID },
      {
        $setOnInsert: {
          communityId: GLOBAL_COMMUNITY_ID,
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
          version: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    for (const userId of userIds) {
      await db.collection('users').updateOne(
        { id: userId },
        { $pull: { communityMemberships: RUNTIME_COMMUNITY_ID } },
      );
      await db.collection('users').updateOne(
        { id: userId },
        { $addToSet: { communityMemberships: GLOBAL_COMMUNITY_ID } },
      );
      await db.collection('communities').updateOne(
        { id: RUNTIME_COMMUNITY_ID },
        { $pull: { members: userId } },
      );
      await db.collection('user_community_roles').deleteMany({
        userId,
        communityId: RUNTIME_COMMUNITY_ID,
      });
      await db.collection('user_community_roles').updateOne(
        { userId, communityId: GLOBAL_COMMUNITY_ID },
        {
          $setOnInsert: {
            id: randomUUID(),
            userId,
            communityId: GLOBAL_COMMUNITY_ID,
            role: 'participant',
            membershipStatus: 'active',
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true },
      );
    }
  });
}

async function listingInCommunity(
  factory: UzzSeedFactory,
  communityId: string,
  input: Parameters<UzzSeedFactory['listing']>[0] = {},
): Promise<SeededListing> {
  const listing = await factory.listing(input);
  if (communityId !== factory.communityId) {
    await withE2eDb((db) =>
      db.collection('uzz_listings').updateOne({ id: listing.id }, { $set: { communityId } }),
    );
  }
  return { ...listing, communityId };
}

async function rightInCommunity(
  factory: UzzSeedFactory,
  communityId: string,
  input: Parameters<UzzSeedFactory['seedRight']>[0],
): Promise<SeededRight> {
  const right = await factory.seedRight(input);
  if (communityId !== factory.communityId) {
    await withE2eDb((db) =>
      db.collection('uzz_rights').updateOne({ id: right.id }, { $set: { communityId } }),
    );
  }
  return { ...right, communityId };
}

async function updateRightNominal(rightId: string, nominalRub: number): Promise<void> {
  await withE2eDb((db) =>
    db.collection('uzz_rights').updateOne(
      { id: rightId },
      { $set: { nominalRub, updatedAt: new Date() } },
    ),
  );
}

async function insertDueDeal(
  runId: string,
  communityId: string,
  input: {
    id: string;
    buyerId: string;
    sellerId: string;
    listingId: string;
    rightId: string;
    title: string;
    feeSourceCommunityId: string;
  },
): Promise<{ id: string }> {
  const now = new Date();
  const expired = new Date(now.getTime() - 60_000);
  await withE2eDb((db) =>
    db.collection('uzz_deals').insertOne({
      id: input.id,
      communityId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      listingId: input.listingId,
      exchangeRightId: input.rightId,
      lotId: input.listingId,
      bankId: input.rightId,
      status: 'requested',
      requestMessage: 'Срок уже вышел',
      listingSnapshot: {
        title: input.title,
        priceRub: 500,
        deliveryMode: 'offline',
        locationText: 'у вас дома',
      },
      requestedDeadlineAt: null,
      agreedDeadlineAt: null,
      acceptedNominalRub: null,
      dealAmountRub: null,
      requestExpiresAt: expired,
      fulfillmentExpiresAt: null,
      confirmationExpiresAt: null,
      buyerContact: null,
      sellerContact: null,
      feeReserved: true,
      feeSourceCommunityId: input.feeSourceCommunityId,
      feePayerUserId: input.buyerId,
      adminResolutionReason: null,
      requestedAt: expired,
      acceptedAt: null,
      completedBySellerAt: null,
      closedAt: null,
      rejectedAt: null,
      cancelledAt: null,
      buyerThankedAt: null,
      sellerThankedAt: null,
      buyerThanksComment: null,
      sellerThanksComment: null,
      buyerThanksMerits: null,
      sellerThanksMerits: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
      runId,
    }),
  );
  return { id: input.id };
}

async function insertOutboxEvent(
  runId: string,
  input: { telegramUserId: string; text: string },
): Promise<{ id: string }> {
  const id = `outbox-${runId}-${randomUUID()}`;
  const now = new Date();
  await withE2eDb((db) =>
    db.collection('uzz_outbox').insertOne({
      id,
      topic: 'uzz.telegram',
      aggregateId: id,
      payload: {
        telegramUserId: input.telegramUserId,
        text: input.text,
        path: '/deals',
        kind: 'deal_requested',
      },
      attempts: 0,
      availableAt: now,
      processedAt: null,
      lockedUntil: null,
      deadLetteredAt: null,
      lastError: null,
      leaseToken: null,
      leaseOwner: null,
      createdAt: now,
      runId,
    }),
  );
  return { id };
}

export async function snapshotEconomics(userIds: string[]): Promise<EconomicsSnapshot> {
  return withE2eDb(async (db) => {
    const [wallets, rights, deals, ledger, outbox] = await Promise.all([
      db.collection('wallets').find({ userId: { $in: userIds } }).toArray(),
      db.collection('uzz_rights').find({ ownerId: { $in: userIds } }).toArray(),
      db.collection('uzz_deals').find({
        $or: [{ buyerId: { $in: userIds } }, { sellerId: { $in: userIds } }],
      }).toArray(),
      db.collection('uzz_ledger').find({ userId: { $in: userIds } }).toArray(),
      db.collection('uzz_outbox').find({
        $or: [
          { 'payload.telegramUserId': { $in: userIds } },
          { 'payload.targetUserId': { $in: userIds } },
        ],
      }).toArray(),
    ]);
    const transactionCount = await db.collection('transactions').countDocuments({
      walletId: { $in: wallets.map((row) => String(row.id)) },
    });
    return {
      wallets: wallets.map((row) => ({
        id: String(row.id),
        userId: String(row.userId),
        communityId: String(row.communityId),
        balance: Number(row.balance),
      })),
      rights: rights.map((row) => ({
        id: String(row.id),
        ownerId: String(row.ownerId),
        status: String(row.status),
        nominalRub: row.nominalRub == null ? null : Number(row.nominalRub),
        lockedByDealId: row.lockedByDealId == null ? null : String(row.lockedByDealId),
      })),
      deals: deals.map((row) => ({
        id: String(row.id),
        status: String(row.status),
        feeReserved: Boolean(row.feeReserved),
      })),
      ledger: ledger.map((row) => ({
        id: String(row.id),
        type: String(row.type),
        amount: Number(row.amount),
        userId: String(row.userId),
      })),
      outbox: outbox.map((row) => ({
        id: String(row.id),
        processedAt: row.processedAt ? new Date(String(row.processedAt)) : null,
        leaseToken: row.leaseToken == null ? null : String(row.leaseToken),
      })),
      transactionCount,
    };
  });
}

async function cleanupEconomicsSince(startedAt: Date, runId: string): Promise<void> {
  await withE2eDb(async (db) => {
    await Promise.all([
      db.collection('uzz_deals').deleteMany({ $or: [{ runId }, { createdAt: { $gte: startedAt } }] }),
      db.collection('uzz_ledger').deleteMany({ createdAt: { $gte: startedAt } }),
      db.collection('uzz_outbox').deleteMany({ $or: [{ runId }, { createdAt: { $gte: startedAt } }] }),
      db.collection('uzz_commands').deleteMany({ createdAt: { $gte: startedAt } }),
      db.collection('wallets').deleteMany({ runId }),
      db.collection('transactions').deleteMany({ createdAt: { $gte: startedAt } }),
    ]);
  });
}

export async function findDealByParticipants(
  userIds: string[],
): Promise<Record<string, unknown> | null> {
  return withE2eDb((db) =>
    db.collection('uzz_deals').findOne({
      $or: [{ buyerId: { $in: userIds } }, { sellerId: { $in: userIds } }],
    }),
  );
}

export async function findOutboxById(id: string): Promise<Record<string, unknown> | null> {
  return withE2eDb((db) => db.collection('uzz_outbox').findOne({ id }));
}

export async function ackOutboxWithToken(id: string, leaseToken: string): Promise<number> {
  const result = await withE2eDb((db) =>
    db.collection('uzz_outbox').updateOne(
      { id, leaseToken, processedAt: null },
      { $set: { processedAt: new Date(), lockedUntil: null } },
    ),
  );
  return result.matchedCount;
}

export async function expireOutboxLease(id: string): Promise<void> {
  await withE2eDb((db) =>
    db.collection('uzz_outbox').updateOne(
      { id, processedAt: null },
      { $set: { lockedUntil: new Date(0) } },
    ),
  );
}

const EXPIRY_RUNNER_SOURCE = `import mongoose from 'mongoose';
import { ExpireDealsUseCase } from '../../src/application/uzz/use-cases/expire-deals.use-case';
import {
  createMongooseUzzRepositories,
  initializeUzzModels,
} from '../../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';

type Race = { acceptId: string; closeId: string };

async function mutateAfterScan(connection: mongoose.Connection, race: Race): Promise<void> {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const deals = connection.collection('uzz_deals');
  await deals.updateOne(
    { id: race.acceptId },
    { $set: { status: 'accepted', fulfillmentExpiresAt: future, acceptedAt: new Date() } },
  );
  await deals.updateOne(
    { id: race.closeId },
    { $set: { status: 'closed', closedAt: new Date(), feeReserved: false } },
  );
}

async function main(): Promise<void> {
  const input = JSON.parse(process.env.UZZ_EXPIRY_INPUT ?? '{}') as {
    mongoUrl: string;
    limit?: number;
    afterId?: string | null;
    race?: Race;
  };
  const connection = await mongoose.createConnection(input.mongoUrl).asPromise();
  try {
    await initializeUzzModels(connection);
    const runWork = async <T>(
      work: (repos: ReturnType<typeof createMongooseUzzRepositories>) => Promise<T>,
    ): Promise<T> => {
      const session = await connection.startSession();
      let result: T | undefined;
      let completed = false;
      try {
        await session.withTransaction(async () => {
          result = await work(createMongooseUzzRepositories(connection, session));
          completed = true;
        });
      } finally {
        await session.endSession();
      }
      if (!completed) throw new Error('UZZ transaction ended without completing its work');
      return result as T;
    };
    let scanned = false;
    const unitOfWork = {
      async run<T>(
        work: (repos: ReturnType<typeof createMongooseUzzRepositories>) => Promise<T>,
      ): Promise<T> {
        const result = await runWork(work);
        if (input.race && !scanned) {
          scanned = true;
          await mutateAfterScan(connection, input.race);
        }
        return result;
      },
    };
    const expiry = new ExpireDealsUseCase(unitOfWork, { now: () => new Date() });
    const page = await expiry.executePage({
      afterId: input.afterId ?? null,
      limit: input.limit ?? 3,
    });
    process.stdout.write(\`UZZ_EXPIRY_RESULT:\${JSON.stringify(page)}\\n\`);
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
`;

function apiPackageRoot(): string {
  const candidates = [
    path.join(process.cwd(), '..', 'api', 'package.json'),
    path.join(process.cwd(), 'api', 'package.json'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Cannot resolve api/package.json');
  return path.dirname(found);
}

export async function runExpiryPage(input?: {
  race?: { acceptId: string; closeId: string };
  limit?: number;
  afterId?: string | null;
}): Promise<{ processed: number; skipped: number; failed: number; lastId: string | null }> {
  const apiRoot = apiPackageRoot();
  const runnerPath = path.join(apiRoot, 'apps', 'meriter', 'test', 'uzz-e2e', '_run-expiry-page.ts');
  const req = createRequire(path.join(apiRoot, 'package.json'));
  const tsNodeRegister = req.resolve('ts-node/register/transpile-only');
  fs.writeFileSync(runnerPath, EXPIRY_RUNNER_SOURCE);
  try {
    const spawned = spawnSync(process.execPath, ['-r', tsNodeRegister, runnerPath], {
      cwd: apiRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        TS_NODE_PROJECT: path.join(apiRoot, 'tsconfig.json'),
        TS_NODE_TRANSPILE_ONLY: '1',
        UZZ_EXPIRY_INPUT: JSON.stringify({
          mongoUrl: e2eMongoUrl(),
          race: input?.race,
          afterId: input?.afterId ?? null,
          limit: input?.limit ?? (input?.race ? 3 : 10),
        }),
      },
    });
    if (spawned.status !== 0) {
      throw new Error(
        `expiry runner failed (${spawned.status}): ${spawned.stderr || spawned.stdout}`,
      );
    }
    const line = (spawned.stdout ?? '')
      .split(/\r?\n/)
      .reverse()
      .find((row) => row.startsWith('UZZ_EXPIRY_RESULT:'));
    if (!line) {
      throw new Error(`expiry runner produced no result: ${spawned.stdout}`);
    }
    return JSON.parse(line.slice('UZZ_EXPIRY_RESULT:'.length)) as {
      processed: number;
      skipped: number;
      failed: number;
      lastId: string | null;
    };
  } finally {
    fs.rmSync(runnerPath, { force: true });
  }
}

const OUTBOX_RUNNER_SOURCE = `import mongoose from 'mongoose';
import { DeliverUzzOutboxUseCase } from '../../src/application/uzz/use-cases/deliver-uzz-outbox.use-case';
import {
  createMongooseUzzRepositories,
  initializeUzzModels,
} from '../../src/infrastructure/uzz/persistence/mongoose-uzz-repositories';

async function main(): Promise<void> {
  const input = JSON.parse(process.env.UZZ_OUTBOX_INPUT ?? '{}') as {
    mongoUrl: string;
    telegramUrl: string;
    limit?: number;
  };
  const connection = await mongoose.createConnection(input.mongoUrl).asPromise();
  try {
    await initializeUzzModels(connection);
    const unitOfWork = {
      async run<T>(
        work: (repos: ReturnType<typeof createMongooseUzzRepositories>) => Promise<T>,
      ): Promise<T> {
        const session = await connection.startSession();
        let result: T | undefined;
        let completed = false;
        try {
          await session.withTransaction(async () => {
            result = await work(createMongooseUzzRepositories(connection, session));
            completed = true;
          });
        } finally {
          await session.endSession();
        }
        if (!completed) throw new Error('UZZ transaction ended without completing its work');
        return result as T;
      },
    };
    const sender = {
      async send(_eventId: string, payload: { telegramChatId?: string; telegramUserId?: string; text: string; path?: string }) {
        const response = await fetch(\`\${input.telegramUrl.replace(/\\/$/, '')}/bot${process.env.BOT_TOKEN ?? 'e2e-bot-token-1234'}/sendMessage\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: payload.telegramChatId ?? payload.telegramUserId,
            text: payload.path ? \`\${payload.text}\\n\\n\${payload.path}\` : payload.text,
          }),
        });
        if (!response.ok) {
          throw new Error(\`telegram send failed: \${response.status}\`);
        }
      },
    };
    const deliver = new DeliverUzzOutboxUseCase(unitOfWork, sender, { now: () => new Date() });
    const result = await deliver.executeBatch({ limit: input.limit ?? 1 });
    process.stdout.write(\`UZZ_OUTBOX_RESULT:\${JSON.stringify(result)}\\n\`);
  } finally {
    await connection.close();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
`;

type OutboxBatchResult = { delivered: number; failed: number; deadLettered: number };

function parseOutboxResult(stdout: string, stderr: string): OutboxBatchResult {
  const line = stdout
    .split(/\r?\n/)
    .reverse()
    .find((row) => row.startsWith('UZZ_OUTBOX_RESULT:'));
  if (!line) {
    throw new Error(`outbox runner produced no result: ${stdout || stderr}`);
  }
  return JSON.parse(line.slice('UZZ_OUTBOX_RESULT:'.length)) as OutboxBatchResult;
}

export function runOutboxBatch(): Promise<OutboxBatchResult> {
  const apiRoot = apiPackageRoot();
  const runnerPath = path.join(
    apiRoot,
    'apps',
    'meriter',
    'test',
    'uzz-e2e',
    `_run-outbox-batch-${randomUUID()}.ts`,
  );
  const req = createRequire(path.join(apiRoot, 'package.json'));
  const tsNodeRegister = req.resolve('ts-node/register/transpile-only');
  fs.writeFileSync(runnerPath, OUTBOX_RUNNER_SOURCE);
  const telegramUrl = process.env.UZZ_E2E_TELEGRAM_CONTROL_URL ?? 'http://127.0.0.1:19091';
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-r', tsNodeRegister, runnerPath], {
      cwd: apiRoot,
      env: {
        ...process.env,
        TS_NODE_PROJECT: path.join(apiRoot, 'tsconfig.json'),
        TS_NODE_TRANSPILE_ONLY: '1',
        UZZ_OUTBOX_INPUT: JSON.stringify({
          mongoUrl: e2eMongoUrl(),
          telegramUrl,
          limit: 1,
        }),
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      fs.rmSync(runnerPath, { force: true });
      reject(error);
    });
    child.on('close', (status) => {
      fs.rmSync(runnerPath, { force: true });
      if (status !== 0) {
        reject(new Error(`outbox runner failed (${status}): ${stderr || stdout}`));
        return;
      }
      try {
        resolve(parseOutboxResult(stdout, stderr));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function injectWriteFailureOnce(namespace: string): Promise<void> {
  const client = new MongoClient(e2eMongoUrl());
  await client.connect();
  try {
    await client.db('admin').command({
      configureFailPoint: 'failCommand',
      mode: { times: 1 },
      data: {
        failCommands: ['insert', 'findAndModify', 'update'],
        namespace,
        errorCode: 8,
      },
    });
  } finally {
    await client.close();
  }
}

export async function waitUntil(
  probe: () => Promise<boolean>,
  timeoutMs = 45_000,
  intervalMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`timed out after ${timeoutMs}ms`);
}

export async function loginViaEmail(
  page: Page,
  email: string,
  nextPath = '/catalog',
): Promise<{ url: string; token: string }> {
  await resetFakeEmail();
  await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Получить ссылку' }).click();
  await expect(page.getByText(new RegExp(`Письмо отправлено на ${email}`))).toBeVisible();
  const emailMessage = await waitForLastEmail({ to: email });
  expect(emailMessage.to.toLowerCase()).toBe(email.toLowerCase());
  return magicLinkFromEmail(emailMessage);
}

export async function loginAs(page: Page, email: string, nextPath = '/catalog'): Promise<void> {
  const { url } = await loginViaEmail(page, email, nextPath);
  await page.goto(new URL(url).pathname);
  await expect(page.getByRole('heading', { name: 'Не удалось войти' })).toHaveCount(0, {
    timeout: 20_000,
  });
  const dest = nextPath.split('?')[0] || '/catalog';
  await expect(page).toHaveURL(new RegExp(dest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
    timeout: 20_000,
  });
}

export function parseTrpcJson(body: string): unknown {
  const parsed = JSON.parse(body) as unknown;
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!row || typeof row !== 'object') return parsed;
  const record = row as {
    result?: { data?: { json?: unknown } };
    error?: { json?: unknown };
  };
  return record.result?.data?.json ?? record.error?.json ?? parsed;
}

function trpcBatchNames(url: string): string[] {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    return last.split(',');
  } catch {
    return [];
  }
}

function matchesTrpcProcedure(name: string, procedure: string): boolean {
  return (
    name === procedure ||
    name === `uzz.${procedure}` ||
    name.endsWith(`.${procedure}`)
  );
}

function extractTrpcProcedurePayload(body: string, procedure: string, names: string[]): string {
  const parsed = JSON.parse(body) as unknown;
  if (!Array.isArray(parsed)) return body;
  const index = names.findIndex((name) => matchesTrpcProcedure(name, procedure));
  const row = parsed[index >= 0 ? index : 0];
  return JSON.stringify(row ?? parsed[0] ?? parsed);
}

export function captureTrpcResponses(
  page: Page,
  procedure: string,
): Array<{ status: number; body: string }> {
  const captured: Array<{ status: number; body: string }> = [];
  page.on('response', (response) => {
    const names = trpcBatchNames(response.url());
    if (!names.some((name) => matchesTrpcProcedure(name, procedure))) return;
    void response
      .text()
      .then((body) => {
        captured.push({
          status: response.status(),
          body: extractTrpcProcedurePayload(body, procedure, names),
        });
      })
      .catch(() => undefined);
  });
  return captured;
}
