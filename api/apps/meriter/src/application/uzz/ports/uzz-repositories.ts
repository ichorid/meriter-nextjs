import { Deal } from '../../../domain/uzz/entities/deal';
import { ExchangeRight } from '../../../domain/uzz/entities/exchange-right';
import { Listing } from '../../../domain/uzz/entities/listing';
import { UzzWalletPort } from './uzz-wallet.port';

export interface UzzSettingsRecord {
  communityId: string;
  emissionThreshold: number;
  initialHops: number;
  demurrageRubPerDay: number;
  nominalFloorRub: number;
  minimumListingsToBuy: number;
  purchaseGateMode: 'nudge' | 'require_min_lots';
  requestTtlHours: number;
  fulfillmentTtlDays: number;
  confirmationTtlDays: number;
  notifyRightEmitted: boolean;
  notifyRequestLifecycle: boolean;
  notifyDealProgress: boolean;
  notifyDealClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface UzzIdentityRecord {
  id: string;
  canonicalUserId: string;
  normalizedEmail: string | null;
  telegramUserId: string | null;
  telegramUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface UzzIdentityAliasRecord {
  id: string;
  identityId: string;
  aliasUserId: string;
  createdAt: Date;
}

export interface UzzIdentityTokenRecord {
  id: string;
  identityId: string;
  purpose: 'telegram_link';
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
  createdAt: Date;
}

export interface UzzLedgerEntry {
  id: string;
  operationId: string;
  communityId: string;
  userId: string;
  type:
    | 'fee_reserved'
    | 'fee_refunded'
    | 'right_received'
    | 'right_sent'
    | 'thanks_sent'
    | 'thanks_received'
    | 'admin_resolution'
    | 'deal_requested'
    | 'deal_accepted'
    | 'deal_completed'
    | 'deal_closed'
    | 'deal_rejected'
    | 'deal_cancelled'
    | 'demurrage'
    | 'nominal_assigned'
    | 'right_emitted';
  amount: number;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface UzzCommandRecord {
  commandId: string;
  actorId: string;
  type: string;
  payloadHash: string;
  status: 'started' | 'completed' | 'failed';
  result?: unknown;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UzzOutboxRecord {
  id: string;
  topic: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  attempts: number;
  availableAt: Date;
  processedAt: Date | null;
  lockedUntil: Date | null;
  deadLetteredAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

export interface ExchangeRightRepository {
  findById(id: string): Promise<ExchangeRight | null>;
  findBySourcePublicationId(sourcePublicationId: string): Promise<ExchangeRight | null>;
  listDemurrageCandidates(before: Date, afterId: string | null, limit: number): Promise<ExchangeRight[]>;
  listByOwners(communityId: string, ownerIds: string[]): Promise<ExchangeRight[]>;
  listByStatus(communityId: string, statuses: string[]): Promise<ExchangeRight[]>;
  listHoldingByOwners(ownerIds: string[]): Promise<ExchangeRight[]>;
  insert(right: ExchangeRight): Promise<void>;
  update(right: ExchangeRight): Promise<void>;
}

export interface ListingRepository {
  findById(id: string): Promise<Listing | null>;
  listActive(communityId: string): Promise<Listing[]>;
  listByAuthor(communityId: string, authorId: string): Promise<Listing[]>;
  countActiveByAuthor(communityId: string, authorId: string): Promise<number>;
  insert(listing: Listing): Promise<void>;
  update(listing: Listing): Promise<void>;
}

export interface DealRepository {
  findById(id: string): Promise<Deal | null>;
  findOpenByRightId(exchangeRightId: string): Promise<Deal | null>;
  listDue(now: Date, afterId: string | null, limit: number): Promise<Deal[]>;
  listByParticipants(communityId: string, userIds: string[]): Promise<Deal[]>;
  listOpenByCommunity(communityId: string): Promise<Deal[]>;
  insert(deal: Deal): Promise<void>;
  update(deal: Deal): Promise<void>;
}

export interface UzzSettingsRepository {
  findByCommunityId(communityId: string): Promise<UzzSettingsRecord | null>;
  upsert(settings: UzzSettingsRecord, expectedVersion?: number | null): Promise<void>;
}

export interface UzzIdentityRepository {
  findById(id: string): Promise<UzzIdentityRecord | null>;
  findByCanonicalUserId(canonicalUserId: string): Promise<UzzIdentityRecord | null>;
  findByEmail(normalizedEmail: string): Promise<UzzIdentityRecord | null>;
  findByTelegramUserId(telegramUserId: string): Promise<UzzIdentityRecord | null>;
  insert(identity: UzzIdentityRecord): Promise<void>;
  update(identity: UzzIdentityRecord): Promise<void>;
  insertAlias(alias: UzzIdentityAliasRecord): Promise<void>;
  listAliases(identityId: string): Promise<UzzIdentityAliasRecord[]>;
  findAliasByUserId(aliasUserId: string): Promise<UzzIdentityAliasRecord | null>;
  insertToken(token: UzzIdentityTokenRecord): Promise<void>;
  consumeToken(
    tokenHash: string,
    now: Date,
    maximumAttempts: number,
  ): Promise<UzzIdentityTokenRecord | null>;
}

export interface UzzLedgerRepository {
  append(entry: UzzLedgerEntry): Promise<void>;
  list(input: {
    communityId: string;
    userIds?: string[];
    limit: number;
    skip: number;
  }): Promise<UzzLedgerEntry[]>;
}

export interface UzzCommandRepository {
  find(actorId: string, commandId: string): Promise<UzzCommandRecord | null>;
  insert(command: UzzCommandRecord): Promise<void>;
  update(command: UzzCommandRecord): Promise<void>;
}

export interface UzzOutboxRepository {
  append(event: UzzOutboxRecord): Promise<void>;
  claimAvailable(now: Date, limit: number, lockedUntil: Date): Promise<UzzOutboxRecord[]>;
  markProcessed(id: string, processedAt: Date): Promise<void>;
  markFailed(input: {
    id: string;
    error: string;
    availableAt: Date;
    deadLetteredAt: Date | null;
  }): Promise<void>;
}

export interface UzzRepositories {
  rights: ExchangeRightRepository;
  listings: ListingRepository;
  deals: DealRepository;
  settings: UzzSettingsRepository;
  identities: UzzIdentityRepository;
  ledger: UzzLedgerRepository;
  commands: UzzCommandRepository;
  outbox: UzzOutboxRepository;
  wallet: UzzWalletPort;
}
