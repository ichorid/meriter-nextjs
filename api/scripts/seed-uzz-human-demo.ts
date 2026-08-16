import { Db, MongoClient } from 'mongodb';
import { parseMongoTarget } from './reset-uzz-pilot-data';
import {
  DEFAULT_DEMO_COMMUNITY_ID,
  DEMO_DEALS,
  DEMO_PERSONAS,
  DEMO_TAG,
  DemoPersona,
} from './uzz-human-demo-world';

const FORBIDDEN_DATABASES = new Set(['test', 'admin', 'local', 'config']);
const GLOBAL_COMMUNITY_ID = '__global__';
const MERIT_CURRENCY = { singular: 'заслуга', plural: 'заслуги', genitive: 'заслуг' };

export interface SeedArguments {
  environment: string;
  expectedHost: string;
  expectedDb: string;
  communityId: string;
  apply: boolean;
  confirmation: string | null;
  grantEmail: string | null;
}

export interface SeedTarget {
  environment: string;
  expectedHost: string;
  expectedDb: string;
  actualHost: string;
  actualDb: string;
}

type DemoDb = Pick<Db, 'collection'>;

export function seedConfirmationToken(environment: string, database: string): string {
  return `SEED_UZZ_${environment}_${database.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

function value(argv: string[], prefix: string): string {
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? '';
}

export function parseSeedArguments(argv: string[]): SeedArguments {
  const environment = value(argv, '--environment=').trim().toUpperCase();
  if (!environment || !/^[A-Z0-9_-]+$/.test(environment)) {
    throw new Error('Pass --environment=<name>');
  }
  if (environment === 'PRODUCTION' || environment === 'PROD') {
    throw new Error('Refusing PRODUCTION/PROD environment for human demo seed');
  }
  const expectedHost = value(argv, '--expected-host=').trim();
  if (!expectedHost) throw new Error('Pass --expected-host=<host>');
  const expectedDb = value(argv, '--expected-db=').trim();
  if (!expectedDb) throw new Error('Pass --expected-db=<database>');
  const apply = argv.includes('--apply');
  const confirmation = value(argv, '--confirm=').trim() || null;
  const required = seedConfirmationToken(environment, expectedDb);
  if (apply && confirmation !== required) {
    throw new Error(`Apply requires --confirm=${required}`);
  }
  return {
    environment,
    expectedHost,
    expectedDb,
    communityId: value(argv, '--community-id=').trim()
      || process.env.DEFAULT_TELEGRAM_COMMUNITY_ID?.trim()
      || DEFAULT_DEMO_COMMUNITY_ID,
    apply,
    confirmation,
    grantEmail: value(argv, '--grant-email=').trim().toLowerCase() || null,
  };
}

function isProductionHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h.includes('prod')) return true;
  if (h.split(',').some((part) => part.endsWith('.mongodb.net'))) return true;
  return /\.(com|net|org|pro|io)$/i.test(h);
}

export function prepareSeed(
  argv: string[],
  mongoUrl: string,
  extras: { uzzDomain?: string } = {},
): { args: SeedArguments; target: SeedTarget; message: string } {
  const args = parseSeedArguments(argv);
  const domain = (extras.uzzDomain ?? process.env.UZZ_DOMAIN ?? '').trim().toLowerCase();
  if (domain === 'cw.ru' || domain.endsWith('.cw.ru')) {
    throw new Error('Refusing human demo seed for UZZ_DOMAIN=cw.ru');
  }
  if (!mongoUrl.trim()) throw new Error('MONGO_URL is required');
  const actual = parseMongoTarget(mongoUrl.trim());
  const target: SeedTarget = {
    environment: args.environment,
    expectedHost: args.expectedHost,
    expectedDb: args.expectedDb,
    actualHost: actual.host,
    actualDb: actual.database,
  };
  if (target.expectedHost.toLowerCase() !== target.actualHost) {
    throw new Error(`Host mismatch: expected ${target.expectedHost}, actual ${target.actualHost}`);
  }
  if (target.expectedDb.toLowerCase() !== target.actualDb.toLowerCase()) {
    throw new Error(`Database mismatch: expected ${target.expectedDb}, actual ${target.actualDb}`);
  }
  if (args.apply) {
    if (isProductionHost(target.actualHost)) {
      throw new Error(`Refusing production MongoDB URL (host=${target.actualHost})`);
    }
    if (FORBIDDEN_DATABASES.has(target.actualDb.toLowerCase())) {
      throw new Error(`Refusing seed of broad or default database "${target.actualDb}"`);
    }
  }
  return {
    args,
    target,
    message: `Resolved UZZ human-demo target: host=${target.actualHost} database=${target.actualDb} environment=${target.environment}`,
  };
}

async function upsert(
  db: DemoDb,
  collection: string,
  filter: Record<string, unknown>,
  doc: Record<string, unknown>,
) {
  await db.collection(collection).updateOne(
    filter,
    { $set: { ...doc, [DEMO_TAG]: true }, $setOnInsert: {} },
    { upsert: true },
  );
}

function hoursFrom(now: Date, hours: number): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function seedPersona(db: DemoDb, communityId: string, persona: DemoPersona, now: Date) {
  const createdAt = daysAgo(now, 20);
  await upsert(db, 'users', { id: persona.id }, {
    id: persona.id,
    authProvider: 'email',
    authId: persona.email,
    firstName: persona.firstName,
    lastName: persona.lastName,
    displayName: persona.displayName,
    username: persona.telegramUsername,
    profile: { bio: persona.bio },
    communityTags: [],
    communityMemberships: [communityId],
    createdAt,
    updatedAt: now,
  });
  await upsert(db, 'user_auth_identities', { id: `auth-${persona.id}` }, {
    id: `auth-${persona.id}`,
    userId: persona.id,
    provider: 'email',
    authId: persona.email,
    linkedAt: createdAt,
    createdAt,
    updatedAt: now,
  });
  await upsert(db, 'user_community_roles', { id: `role-${persona.id}` }, {
    id: `role-${persona.id}`,
    userId: persona.id,
    communityId,
    role: 'participant',
    membershipStatus: 'active',
    createdAt,
    updatedAt: now,
  });
  await upsert(db, 'uzz_identities', { id: `identity-${persona.id}` }, {
    id: `identity-${persona.id}`,
    canonicalUserId: persona.id,
    normalizedEmail: persona.email,
    telegramUserId: persona.telegramUserId,
    telegramUsername: persona.telegramUsername,
    version: 0,
    createdAt,
    updatedAt: now,
  });
  for (const walletCommunityId of [communityId, GLOBAL_COMMUNITY_ID]) {
    await upsert(db, 'wallets', { id: `wallet-${persona.id}-${walletCommunityId}` }, {
      id: `wallet-${persona.id}-${walletCommunityId}`,
      userId: persona.id,
      communityId: walletCommunityId,
      balance: walletCommunityId === GLOBAL_COMMUNITY_ID ? 25 : 18,
      currency: MERIT_CURRENCY,
      lastUpdated: now,
    });
  }
  await upsert(db, 'publications', { id: persona.publicationId }, {
    id: persona.publicationId,
    communityId,
    authorId: persona.id,
    title: persona.deedTitle,
    content: persona.deedBody,
    description: persona.deedBody,
    type: 'text',
    postType: 'basic',
    hashtags: ['добро', 'пилот'],
    metrics: { upvotes: 14, downvotes: 0, score: 14, commentCount: 2 },
    deleted: false,
    status: 'active',
    createdAt,
    updatedAt: now,
  });
  const rightInDeal = DEMO_DEALS.some(
    (deal) => deal.rightId === persona.rightId && ['requested', 'accepted'].includes(deal.status),
  );
  const closedDeal = DEMO_DEALS.find(
    (deal) => deal.rightId === persona.rightId && deal.status === 'closed',
  );
  await upsert(db, 'uzz_rights', { id: persona.rightId }, {
    id: persona.rightId,
    communityId,
    ownerId: closedDeal ? closedDeal.buyerId : persona.id,
    sourcePublicationId: persona.publicationId,
    nominalRub: persona.nominalRub,
    nominalAssignedAt: createdAt,
    lastDemurrageAt: createdAt,
    hopsLeft: closedDeal ? 9 : 10,
    status: rightInDeal ? 'in_deal' : closedDeal ? 'active' : 'active',
    lockedByDealId: rightInDeal
      ? DEMO_DEALS.find((deal) => deal.rightId === persona.rightId && ['requested', 'accepted'].includes(deal.status))?.id
      : null,
    ownerHistory: [
      { userId: persona.id, at: createdAt, reason: 'emission' },
      ...(closedDeal
        ? [{ userId: closedDeal.buyerId, at: daysAgo(now, closedDeal.daysAgo), reason: 'deal_closed' }]
        : []),
    ],
    version: 0,
    createdAt,
    updatedAt: now,
  });
  await upsert(db, 'uzz_listings', { id: persona.listing.id }, {
    id: persona.listing.id,
    communityId,
    authorId: persona.id,
    title: persona.listing.title,
    description: persona.listing.description,
    priceRub: persona.listing.priceRub,
    deliveryMode: persona.listing.deliveryMode,
    locationText: persona.listing.locationText,
    durationText: persona.listing.durationText,
    availabilityText: persona.listing.availabilityText,
    active: !rightInDeal && !closedDeal,
    version: 0,
    createdAt,
    updatedAt: now,
  });
}

export async function seedHumanDemoWorld(
  db: DemoDb,
  input: { communityId: string; now: Date; apply: boolean },
) {
  const summary = {
    users: DEMO_PERSONAS.length,
    listings: DEMO_PERSONAS.length,
    deals: DEMO_DEALS.length,
  };
  if (!input.apply) return summary;

  const community = await db.collection('communities').findOne({ id: input.communityId });
  const members = new Set<string>([
    ...((community?.members as string[] | undefined) ?? []),
    ...DEMO_PERSONAS.map((persona) => persona.id),
  ]);
  await db.collection('communities').updateOne(
    { id: input.communityId },
    {
      $set: {
        members: [...members],
        updatedAt: input.now,
        [DEMO_TAG]: true,
      },
      $setOnInsert: {
        id: input.communityId,
        name: 'Пилот «Услуги за заслуги»',
        hashtags: ['пилот', 'uzz'],
        isActive: true,
        isPriority: false,
        settings: { currencyNames: MERIT_CURRENCY, dailyEmission: 10 },
        createdAt: daysAgo(input.now, 30),
      },
    },
    { upsert: true },
  );
  await upsert(db, 'uzz_settings', { communityId: input.communityId }, {
    communityId: input.communityId,
    emissionThreshold: 10,
    initialHops: 10,
    demurrageRubPerDay: 100,
    nominalFloorRub: 100,
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
    createdAt: daysAgo(input.now, 30),
    updatedAt: input.now,
  });

  for (const persona of DEMO_PERSONAS) {
    await seedPersona(db, input.communityId, persona, input.now);
  }

  for (const deal of DEMO_DEALS) {
    const seller = DEMO_PERSONAS.find((persona) => persona.id === deal.sellerId)!;
    const requestedAt = daysAgo(input.now, deal.daysAgo);
    const closed = deal.status === 'closed';
    await upsert(db, 'uzz_deals', { id: deal.id }, {
      id: deal.id,
      communityId: input.communityId,
      buyerId: deal.buyerId,
      sellerId: deal.sellerId,
      listingId: deal.listingId,
      exchangeRightId: deal.rightId,
      lotId: deal.listingId,
      bankId: deal.rightId,
      status: deal.status,
      requestMessage: deal.requestMessage,
      listingSnapshot: {
        title: seller.listing.title,
        priceRub: seller.listing.priceRub,
        deliveryMode: seller.listing.deliveryMode,
        locationText: seller.listing.locationText,
      },
      requestedDeadlineAt: null,
      agreedDeadlineAt: deal.status === 'accepted' || closed ? hoursFrom(requestedAt, 72) : null,
      acceptedNominalRub: deal.acceptedNominalRub,
      dealAmountRub: deal.acceptedNominalRub,
      requestExpiresAt: hoursFrom(requestedAt, deal.requestExpiresInHours),
      fulfillmentExpiresAt: deal.status === 'accepted' || closed ? hoursFrom(requestedAt, 7 * 24) : null,
      confirmationExpiresAt: closed ? hoursFrom(requestedAt, 10 * 24) : null,
      buyerContact: { telegramUsername: DEMO_PERSONAS.find((p) => p.id === deal.buyerId)!.telegramUsername },
      sellerContact: { telegramUsername: seller.telegramUsername },
      feeReserved: deal.status !== 'cancelled',
      feeSourceCommunityId: input.communityId,
      feePayerUserId: deal.buyerId,
      adminResolutionReason: null,
      requestedAt,
      acceptedAt: deal.status === 'accepted' || closed ? hoursFrom(requestedAt, 2) : null,
      completedBySellerAt: closed ? hoursFrom(requestedAt, 26) : null,
      closedAt: closed ? hoursFrom(requestedAt, 30) : null,
      rejectedAt: null,
      cancelledAt: deal.status === 'cancelled' ? hoursFrom(requestedAt, 6) : null,
      buyerThankedAt: deal.thanked ? hoursFrom(requestedAt, 32) : null,
      sellerThankedAt: deal.thanked ? hoursFrom(requestedAt, 33) : null,
      buyerThanksComment: deal.thanksComment ?? null,
      sellerThanksComment: deal.thanked ? 'Рада, что зашло.' : null,
      buyerThanksMerits: deal.thanked ? 2 : null,
      sellerThanksMerits: deal.thanked ? 2 : null,
      version: 0,
    });
    await upsert(db, 'uzz_ledger', { id: `led-req-${deal.id}` }, {
      id: `led-req-${deal.id}`,
      operationId: `deal-request:${deal.id}`,
      communityId: input.communityId,
      userId: deal.buyerId,
      type: 'deal_requested',
      amount: 0,
      metadata: { dealId: deal.id },
      createdAt: requestedAt,
    });
    if (closed) {
      await upsert(db, 'uzz_ledger', { id: `led-close-buy-${deal.id}` }, {
        id: `led-close-buy-${deal.id}`,
        operationId: `deal-close:${deal.id}`,
        communityId: input.communityId,
        userId: deal.buyerId,
        type: 'right_received',
        amount: deal.acceptedNominalRub ?? 0,
        metadata: { dealId: deal.id },
        createdAt: hoursFrom(requestedAt, 30),
      });
      await upsert(db, 'uzz_ledger', { id: `led-close-sell-${deal.id}` }, {
        id: `led-close-sell-${deal.id}`,
        operationId: `deal-close:${deal.id}`,
        communityId: input.communityId,
        userId: deal.sellerId,
        type: 'right_sent',
        amount: deal.acceptedNominalRub ?? 0,
        metadata: { dealId: deal.id },
        createdAt: hoursFrom(requestedAt, 30),
      });
      await upsert(db, 'uzz_ledger', { id: `led-thanks-buy-${deal.id}` }, {
        id: `led-thanks-buy-${deal.id}`,
        operationId: `thanks:${deal.id}`,
        communityId: input.communityId,
        userId: deal.buyerId,
        type: 'thanks_sent',
        amount: 2,
        metadata: { dealId: deal.id },
        createdAt: hoursFrom(requestedAt, 32),
      });
      await upsert(db, 'uzz_ledger', { id: `led-thanks-sell-${deal.id}` }, {
        id: `led-thanks-sell-${deal.id}`,
        operationId: `thanks:${deal.id}`,
        communityId: input.communityId,
        userId: deal.sellerId,
        type: 'thanks_received',
        amount: 2,
        metadata: { dealId: deal.id },
        createdAt: hoursFrom(requestedAt, 32),
      });
    }
  }

  return summary;
}

export async function grantTesterKit(
  db: DemoDb,
  input: { email: string; communityId: string; merits: number; now: Date },
) {
  const email = input.email.trim().toLowerCase();
  const auth = await db.collection('user_auth_identities').findOne({ authId: email });
  const user = auth
    ? await db.collection('users').findOne({ id: auth.userId })
    : await db.collection('users').findOne({ authId: email });
  if (!user?.id) {
    throw new Error('USER_NOT_FOUND');
  }
  const userId = String(user.id);
  const memberships = new Set<string>([
    ...((user.communityMemberships as string[] | undefined) ?? []),
    input.communityId,
  ]);
  await db.collection('users').updateOne(
    { id: userId },
    { $set: { communityMemberships: [...memberships], updatedAt: input.now } },
  );
  const community = await db.collection('communities').findOne({ id: input.communityId });
  await db.collection('communities').updateOne(
    { id: input.communityId },
    { $set: { members: [...new Set([...((community?.members as string[] | undefined) ?? []), userId])] } },
    { upsert: true },
  );
  await upsert(db, 'user_community_roles', { id: `role-${userId}` }, {
    id: `role-${userId}`,
    userId,
    communityId: input.communityId,
    role: 'participant',
    membershipStatus: 'active',
    createdAt: input.now,
    updatedAt: input.now,
  });
  const existingIdentity = await db.collection('uzz_identities').findOne({ canonicalUserId: userId });
  await upsert(db, 'uzz_identities', { id: existingIdentity?.id ?? `identity-${userId}` }, {
    id: existingIdentity?.id ?? `identity-${userId}`,
    canonicalUserId: userId,
    normalizedEmail: email,
    telegramUserId: existingIdentity?.telegramUserId ?? null,
    telegramUsername: existingIdentity?.telegramUsername ?? null,
    version: Number(existingIdentity?.version ?? 0),
    createdAt: existingIdentity?.createdAt ?? input.now,
    updatedAt: input.now,
  });
  await upsert(db, 'wallets', { id: `wallet-${userId}-${input.communityId}` }, {
    id: `wallet-${userId}-${input.communityId}`,
    userId,
    communityId: input.communityId,
    balance: input.merits,
    currency: MERIT_CURRENCY,
    lastUpdated: input.now,
  });
  await upsert(db, 'wallets', { id: `wallet-${userId}-${GLOBAL_COMMUNITY_ID}` }, {
    id: `wallet-${userId}-${GLOBAL_COMMUNITY_ID}`,
    userId,
    communityId: GLOBAL_COMMUNITY_ID,
    balance: input.merits,
    currency: MERIT_CURRENCY,
    lastUpdated: input.now,
  });
  return { userId, merits: input.merits };
}

async function main() {
  const mongoUrl = process.env.MONGO_URL?.trim();
  if (!mongoUrl) throw new Error('MONGO_URL is required');
  const prepared = prepareSeed(process.argv.slice(2), mongoUrl);
  console.log(prepared.message);
  const client = new MongoClient(mongoUrl);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    if (!prepared.args.grantEmail || prepared.args.apply) {
      const summary = await seedHumanDemoWorld(db, {
        communityId: prepared.args.communityId,
        now,
        apply: prepared.args.apply,
      });
      console.log(prepared.args.apply ? 'Human demo world applied' : 'Dry run', summary);
    }
    if (prepared.args.grantEmail) {
      if (!prepared.args.apply) {
        console.log(`Would grant tester kit to ${prepared.args.grantEmail}`);
      } else {
        const kit = await grantTesterKit(db, {
          email: prepared.args.grantEmail,
          communityId: prepared.args.communityId,
          merits: 40,
          now,
        });
        console.log('Tester kit granted', kit);
      }
    }
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
