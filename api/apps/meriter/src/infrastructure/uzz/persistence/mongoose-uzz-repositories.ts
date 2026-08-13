import { ClientSession, Connection, Model, Query } from 'mongoose';
import {
  DealRepository,
  ExchangeRightRepository,
  ListingRepository,
  UzzCommandRecord,
  UzzCommandRepository,
  UzzIdentityAliasRecord,
  UzzIdentityRecord,
  UzzIdentityRepository,
  UzzIdentityTokenRecord,
  UzzLedgerEntry,
  UzzLedgerRepository,
  UzzOutboxRecord,
  UzzOutboxRepository,
  UzzRepositories,
  UzzSettingsRecord,
  UzzSettingsRepository,
} from '../../../application/uzz/ports/uzz-repositories';
import { UzzConflictError } from '../../../domain/uzz/errors';
import { MeriterUzzWalletAdapter } from '../wallet/meriter-uzz-wallet.adapter';
import { UZZ_COMMAND_MODEL, UzzCommandPersistenceSchema } from './schemas/uzz-command.schema';
import { UZZ_DEAL_MODEL, UzzDealPersistenceSchema } from './schemas/uzz-deal.schema';
import {
  UZZ_EXCHANGE_RIGHT_MODEL,
  UzzExchangeRightPersistenceSchema,
} from './schemas/uzz-exchange-right.schema';
import {
  UZZ_IDENTITY_ALIAS_MODEL,
  UzzIdentityAliasPersistenceSchema,
} from './schemas/uzz-identity-alias.schema';
import {
  UZZ_IDENTITY_TOKEN_MODEL,
  UzzIdentityTokenPersistenceSchema,
} from './schemas/uzz-identity-token.schema';
import { UZZ_IDENTITY_MODEL, UzzIdentityPersistenceSchema } from './schemas/uzz-identity.schema';
import { UZZ_LEDGER_MODEL, UzzLedgerPersistenceSchema } from './schemas/uzz-ledger.schema';
import { UZZ_LISTING_MODEL, UzzListingPersistenceSchema } from './schemas/uzz-listing.schema';
import { UZZ_OUTBOX_MODEL, UzzOutboxPersistenceSchema } from './schemas/uzz-outbox.schema';
import { UZZ_SETTINGS_MODEL, UzzSettingsPersistenceSchema } from './schemas/uzz-settings.schema';
import {
  dealFromPersistence,
  dealToPersistence,
  exchangeRightFromPersistence,
  exchangeRightToPersistence,
  listingFromPersistence,
  listingToPersistence,
} from './uzz-mappers';

type PersistenceModel = Model<any>;

export interface MongooseUzzModels {
  rights: PersistenceModel;
  listings: PersistenceModel;
  deals: PersistenceModel;
  settings: PersistenceModel;
  identities: PersistenceModel;
  identityAliases: PersistenceModel;
  identityTokens: PersistenceModel;
  ledger: PersistenceModel;
  commands: PersistenceModel;
  outbox: PersistenceModel;
}

export function getUzzModels(connection: Connection): MongooseUzzModels {
  return {
    rights: model(connection, UZZ_EXCHANGE_RIGHT_MODEL, UzzExchangeRightPersistenceSchema),
    listings: model(connection, UZZ_LISTING_MODEL, UzzListingPersistenceSchema),
    deals: model(connection, UZZ_DEAL_MODEL, UzzDealPersistenceSchema),
    settings: model(connection, UZZ_SETTINGS_MODEL, UzzSettingsPersistenceSchema),
    identities: model(connection, UZZ_IDENTITY_MODEL, UzzIdentityPersistenceSchema),
    identityAliases: model(
      connection,
      UZZ_IDENTITY_ALIAS_MODEL,
      UzzIdentityAliasPersistenceSchema,
    ),
    identityTokens: model(
      connection,
      UZZ_IDENTITY_TOKEN_MODEL,
      UzzIdentityTokenPersistenceSchema,
    ),
    ledger: model(connection, UZZ_LEDGER_MODEL, UzzLedgerPersistenceSchema),
    commands: model(connection, UZZ_COMMAND_MODEL, UzzCommandPersistenceSchema),
    outbox: model(connection, UZZ_OUTBOX_MODEL, UzzOutboxPersistenceSchema),
  };
}

export async function initializeUzzModels(connection: Connection): Promise<void> {
  const models = getUzzModels(connection);
  await Promise.all(Object.values(models).map((registeredModel) => registeredModel.init()));
}

export function createMongooseUzzRepositories(
  connection: Connection,
  session: ClientSession | null,
): UzzRepositories {
  return createRepositories(getUzzModels(connection), session);
}

function createRepositories(
  models: MongooseUzzModels,
  session: ClientSession | null,
): UzzRepositories {
  const options = session ? { session } : undefined;

  const rights: ExchangeRightRepository = {
    async findById(id) {
      const raw = await execute(models.rights.findOne({ id }).lean(), session);
      return raw ? exchangeRightFromPersistence(raw) : null;
    },
    async findBySourcePublicationId(sourcePublicationId) {
      const raw = await execute(
        models.rights.findOne({ sourcePublicationId }).lean(),
        session,
      );
      return raw ? exchangeRightFromPersistence(raw) : null;
    },
    async listDemurrageCandidates(before, afterId, limit) {
      const rows = await execute(
        models.rights.find({
          ...(afterId ? { id: { $gt: afterId } } : {}),
          status: { $in: ['active', 'in_deal'] },
          nominalRub: { $ne: null },
          lastDemurrageAt: { $ne: null, $lte: before },
        }).sort({ id: 1 }).limit(limit).lean(),
        session,
      );
      return (rows as unknown[]).map(exchangeRightFromPersistence);
    },
    async listByOwners(communityId, ownerIds) {
      const rows = await execute(
        models.rights.find({ communityId, ownerId: { $in: ownerIds } })
          .sort({ createdAt: -1 }).lean(), session,
      );
      return (rows as unknown[]).map(exchangeRightFromPersistence);
    },
    async listByStatus(communityId, statuses) {
      const rows = await execute(
        models.rights.find({ communityId, status: { $in: statuses } })
          .sort({ createdAt: 1 }).lean(), session,
      );
      return (rows as unknown[]).map(exchangeRightFromPersistence);
    },
    async listHoldingByOwners(ownerIds) {
      const rows = await execute(
        models.rights.find({ ownerId: { $in: ownerIds }, status: 'holding' }).lean(),
        session,
      );
      return (rows as unknown[]).map(exchangeRightFromPersistence);
    },
    async insert(right) {
      await models.rights.create([exchangeRightToPersistence(right)], options);
    },
    async update(right) {
      const snapshot = exchangeRightToPersistence(right);
      await optimisticUpdate(models.rights, snapshot.id, snapshot.version, snapshot, session);
    },
  };

  const listings: ListingRepository = {
    async findById(id) {
      const raw = await execute(models.listings.findOne({ id }).lean(), session);
      return raw ? listingFromPersistence(raw) : null;
    },
    async listActive(communityId) {
      const rows = await execute(
        models.listings
          .find({ communityId, active: true })
          .sort({ createdAt: -1 })
          .lean(),
        session,
      );
      return (rows as unknown[]).map(listingFromPersistence);
    },
    async listByAuthor(communityId, authorId) {
      const rows = await execute(
        models.listings
          .find({ communityId, authorId })
          .sort({ createdAt: -1 })
          .lean(),
        session,
      );
      return (rows as unknown[]).map(listingFromPersistence);
    },
    async countActiveByAuthor(communityId, authorId) {
      return execute(
        models.listings.countDocuments({ communityId, authorId, active: true }),
        session,
      );
    },
    async insert(listing) {
      await models.listings.create([listingToPersistence(listing)], options);
    },
    async update(listing) {
      const snapshot = listingToPersistence(listing);
      await optimisticUpdate(models.listings, snapshot.id, snapshot.version, snapshot, session);
    },
  };

  const deals: DealRepository = {
    async findById(id) {
      const raw = await execute(models.deals.findOne({ id }).lean(), session);
      return raw ? dealFromPersistence(raw) : null;
    },
    async findOpenByRightId(exchangeRightId) {
      const raw = await execute(
        models.deals
          .findOne({
            exchangeRightId,
            status: { $in: ['requested', 'accepted', 'completed_by_seller'] },
          })
          .lean(),
        session,
      );
      return raw ? dealFromPersistence(raw) : null;
    },
    async listDue(now, afterId, limit) {
      const rows = await execute(
        models.deals.find({
          ...(afterId ? { id: { $gt: afterId } } : {}),
          $or: [
            { status: 'requested', requestExpiresAt: { $lte: now } },
            { status: 'accepted', fulfillmentExpiresAt: { $lte: now } },
            { status: 'completed_by_seller', confirmationExpiresAt: { $lte: now } },
          ],
        }).sort({ id: 1 }).limit(limit).lean(),
        session,
      );
      return (rows as unknown[]).map(dealFromPersistence);
    },
    async listByParticipants(communityId, userIds) {
      const rows = await execute(
        models.deals.find({
          communityId,
          $or: [{ buyerId: { $in: userIds } }, { sellerId: { $in: userIds } }],
        }).sort({ createdAt: -1 }).lean(), session,
      );
      return (rows as unknown[]).map(dealFromPersistence);
    },
    async listOpenByCommunity(communityId) {
      const rows = await execute(
        models.deals.find({
          communityId,
          status: { $in: ['requested', 'accepted', 'completed_by_seller'] },
        }).sort({ createdAt: -1 }).lean(), session,
      );
      return (rows as unknown[]).map(dealFromPersistence);
    },
    async insert(deal) {
      await models.deals.create([dealToPersistence(deal)], options);
    },
    async update(deal) {
      const snapshot = dealToPersistence(deal);
      await optimisticUpdate(models.deals, snapshot.id, snapshot.version, snapshot, session);
    },
  };

  const settings: UzzSettingsRepository = {
    async findByCommunityId(communityId) {
      const raw = await execute(models.settings.findOne({ communityId }).lean(), session);
      return raw ? mapSettings(raw) : null;
    },
    async upsert(record, expectedVersion) {
      if (expectedVersion === null) {
        await models.settings.create([record], options);
        return;
      }
      if (expectedVersion !== undefined) {
        const result = await models.settings.updateOne(
          { communityId: record.communityId, version: expectedVersion },
          { $set: record },
          options,
        );
        if (result.matchedCount !== 1) throw new UzzConflictError('SETTINGS_VERSION_CONFLICT');
        return;
      }
      await models.settings.updateOne(
        { communityId: record.communityId },
        { $set: record },
        { ...options, upsert: true },
      );
    },
  };

  const identities: UzzIdentityRepository = {
    async findById(id) {
      const raw = await execute(models.identities.findOne({ id }).lean(), session);
      return raw ? mapIdentity(raw) : null;
    },
    async findByCanonicalUserId(canonicalUserId) {
      const raw = await execute(
        models.identities.findOne({ canonicalUserId }).lean(),
        session,
      );
      return raw ? mapIdentity(raw) : null;
    },
    async findByEmail(normalizedEmail) {
      const raw = await execute(
        models.identities.findOne({ normalizedEmail }).lean(),
        session,
      );
      return raw ? mapIdentity(raw) : null;
    },
    async findByTelegramUserId(telegramUserId) {
      const raw = await execute(
        models.identities.findOne({ telegramUserId }).lean(),
        session,
      );
      return raw ? mapIdentity(raw) : null;
    },
    async insert(identity) {
      await models.identities.create([identity], options);
    },
    async update(identity) {
      await optimisticUpdate(
        models.identities,
        identity.id,
        identity.version,
        identity,
        session,
      );
    },
    async insertAlias(alias: UzzIdentityAliasRecord) {
      await models.identityAliases.create([alias], options);
    },
    async listAliases(identityId) {
      const rows = await execute(
        models.identityAliases.find({ identityId }).sort({ createdAt: 1 }).lean(),
        session,
      );
      return (rows as unknown[]).map(mapIdentityAlias);
    },
    async findAliasByUserId(aliasUserId) {
      const raw = await execute(
        models.identityAliases.findOne({ aliasUserId }).lean(),
        session,
      );
      return raw ? mapIdentityAlias(raw) : null;
    },
    async insertToken(token: UzzIdentityTokenRecord) {
      await models.identityTokens.create([token], options);
    },
    async consumeToken(tokenHash, now, maximumAttempts) {
      const query = models.identityTokens
        .findOneAndUpdate(
          {
            tokenHash,
            consumedAt: null,
            expiresAt: { $gt: now },
            attemptCount: { $lt: maximumAttempts },
          },
          { $set: { consumedAt: now }, $inc: { attemptCount: 1 } },
          { new: true },
        )
        .lean();
      const raw = await execute(query, session);
      return raw ? mapIdentityToken(raw) : null;
    },
  };

  const ledger: UzzLedgerRepository = {
    async append(entry: UzzLedgerEntry) {
      await models.ledger.create([entry], options);
    },
    async list(input) {
      const rows = await execute(
        models.ledger.find({
          communityId: input.communityId,
          ...(input.userIds?.length ? { userId: { $in: input.userIds } } : {}),
        }).sort({ createdAt: -1 }).skip(input.skip).limit(input.limit).lean(),
        session,
      );
      return (rows as unknown[]).map(mapLedger);
    },
  };

  const commands: UzzCommandRepository = {
    async findById(commandId) {
      return execute(models.commands.findOne({ commandId }).lean(), session) as Promise<
        UzzCommandRecord | null
      >;
    },
    async insert(command) {
      await models.commands.create([command], options);
    },
    async update(command) {
      await models.commands.updateOne(
        { commandId: command.commandId },
        { $set: command },
        options,
      );
    },
  };

  const outbox: UzzOutboxRepository = {
    async append(event: UzzOutboxRecord) {
      await models.outbox.create([event], options);
    },
    async claimAvailable(now, limit, lockedUntil) {
      const claimed: UzzOutboxRecord[] = [];
      for (let index = 0; index < limit; index += 1) {
        const raw = await models.outbox.findOneAndUpdate(
          {
            processedAt: null,
            deadLetteredAt: null,
            availableAt: { $lte: now },
            $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
          },
          { $set: { lockedUntil }, $inc: { attempts: 1 } },
          { ...options, new: true, sort: { availableAt: 1, id: 1 } },
        ).lean();
        if (!raw) break;
        claimed.push(mapOutbox(raw));
      }
      return claimed;
    },
    async markProcessed(id, processedAt) {
      await models.outbox.updateOne(
        { id },
        { $set: { processedAt, lockedUntil: null, lastError: null } },
        options,
      );
    },
    async markFailed(input) {
      await models.outbox.updateOne(
        { id: input.id },
        { $set: {
          lastError: input.error,
          availableAt: input.availableAt,
          lockedUntil: null,
          deadLetteredAt: input.deadLetteredAt,
        } },
        options,
      );
    },
  };

  const wallet = new MeriterUzzWalletAdapter(
    models.rights.db,
    session,
  );

  return {
    rights,
    listings,
    deals,
    settings,
    identities,
    ledger,
    commands,
    outbox,
    wallet,
  };
}

function model(connection: Connection, name: string, schema: any): PersistenceModel {
  return connection.models[name] ?? connection.model(name, schema);
}

async function execute<T>(query: Query<T, any>, session: ClientSession | null): Promise<T> {
  if (session) {
    query.session(session);
  }
  return query.exec();
}

async function optimisticUpdate(
  persistenceModel: PersistenceModel,
  id: string,
  version: number,
  state: object,
  session: ClientSession | null,
): Promise<void> {
  const record = state as unknown as Record<string, unknown>;
  const { version: _version, createdAt: _createdAt, ...mutableState } = record;
  const result = await persistenceModel.updateOne(
    { id, version },
    { $set: mutableState, $inc: { version: 1 } },
    session ? { session } : undefined,
  );
  if (result.matchedCount !== 1) {
    throw new UzzConflictError('UZZ_CONCURRENT_MODIFICATION');
  }
}

function mapIdentity(raw: unknown): UzzIdentityRecord {
  const record = asPersistenceRecord(raw);
  return {
    id: String(record.id),
    canonicalUserId: String(record.canonicalUserId),
    normalizedEmail:
      typeof record.normalizedEmail === 'string' ? record.normalizedEmail : null,
    telegramUserId:
      typeof record.telegramUserId === 'string' ? record.telegramUserId : null,
    telegramUsername:
      typeof record.telegramUsername === 'string'
        ? record.telegramUsername
        : null,
    createdAt: new Date(record.createdAt as Date),
    updatedAt: new Date(record.updatedAt as Date),
    version: Number(record.version),
  };
}

function mapSettings(raw: unknown): UzzSettingsRecord {
  const record = asPersistenceRecord(raw);
  const createdAt = record.createdAt ? new Date(record.createdAt as Date) : new Date(0);
  const updatedAt = record.updatedAt ? new Date(record.updatedAt as Date) : createdAt;
  return {
    communityId: String(record.communityId),
    emissionThreshold: Number(record.emissionThreshold ?? 10),
    initialHops: Number(record.initialHops ?? record.bankInitialHops ?? 10),
    demurrageRubPerDay: Number(record.demurrageRubPerDay ?? 100),
    nominalFloorRub: Number(record.nominalFloorRub ?? 100),
    minimumListingsToBuy: Number(record.minimumListingsToBuy ?? record.minLotsToBuy ?? 3),
    purchaseGateMode: record.purchaseGateMode === 'require_min_lots' ||
      record.purchaseGate === 'require_min_lots' ? 'require_min_lots' : 'nudge',
    requestTtlHours: Number(record.requestTtlHours ?? record.dealRequestTtlHours ?? 48),
    fulfillmentTtlDays: Number(record.fulfillmentTtlDays ?? record.dealFulfillmentDays ?? 7),
    confirmationTtlDays: Number(record.confirmationTtlDays ?? 7),
    createdAt,
    updatedAt,
    version: Number(record.version ?? 0),
  };
}

function mapIdentityToken(raw: unknown): UzzIdentityTokenRecord {
  const record = asPersistenceRecord(raw);
  return {
    id: String(record.id),
    identityId: String(record.identityId),
    purpose: 'telegram_link',
    tokenHash: String(record.tokenHash),
    expiresAt: new Date(record.expiresAt as Date),
    consumedAt: record.consumedAt
      ? new Date(record.consumedAt as Date)
      : null,
    attemptCount: Number(record.attemptCount),
    createdAt: new Date(record.createdAt as Date),
  };
}

function mapIdentityAlias(raw: unknown): UzzIdentityAliasRecord {
  const record = asPersistenceRecord(raw);
  return {
    id: String(record.id),
    identityId: String(record.identityId),
    aliasUserId: String(record.aliasUserId),
    createdAt: new Date(record.createdAt as Date),
  };
}

function mapOutbox(raw: unknown): UzzOutboxRecord {
  const record = asPersistenceRecord(raw);
  return {
    id: String(record.id),
    topic: String(record.topic),
    aggregateId: String(record.aggregateId),
    payload: (record.payload ?? {}) as Record<string, unknown>,
    attempts: Number(record.attempts ?? 0),
    availableAt: new Date(record.availableAt as Date),
    processedAt: record.processedAt ? new Date(record.processedAt as Date) : null,
    lockedUntil: record.lockedUntil ? new Date(record.lockedUntil as Date) : null,
    deadLetteredAt: record.deadLetteredAt ? new Date(record.deadLetteredAt as Date) : null,
    lastError: typeof record.lastError === 'string' ? record.lastError : null,
    createdAt: new Date(record.createdAt as Date),
  };
}

function mapLedger(raw: unknown): UzzLedgerEntry {
  const record = asPersistenceRecord(raw);
  return {
    id: String(record.id),
    operationId: String(record.operationId),
    communityId: String(record.communityId),
    userId: String(record.userId),
    type: record.type as UzzLedgerEntry['type'],
    amount: Number(record.amount ?? 0),
    createdAt: new Date(record.createdAt as Date),
    metadata: (record.metadata ?? {}) as Record<string, unknown>,
  };
}

function asPersistenceRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('UZZ persistence query returned an invalid document');
  }
  return raw as Record<string, unknown>;
}
