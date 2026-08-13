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
      return execute(models.settings.findOne({ communityId }).lean(), session) as Promise<
        UzzSettingsRecord | null
      >;
    },
    async upsert(record) {
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
  };

  return { rights, listings, deals, settings, identities, ledger, commands, outbox };
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

function asPersistenceRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('UZZ persistence query returned an invalid document');
  }
  return raw as Record<string, unknown>;
}
