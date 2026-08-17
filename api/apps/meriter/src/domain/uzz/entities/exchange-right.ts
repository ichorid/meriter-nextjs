import { UzzConflictError, UzzValidationError } from '../errors';
import { Rubles } from '../value-objects/rubles';

export type ExchangeRightStatus =
  | 'holding'
  | 'awaiting_nominal'
  | 'active'
  | 'in_deal'
  | 'exhausted';

export interface ExchangeRightOwnerHistoryEntry {
  userId: string;
  at: Date;
  reason: string;
}

export interface ExchangeRightSnapshot {
  id: string;
  communityId: string;
  ownerId: string;
  sourcePublicationId: string;
  nominalRub: number | null;
  nominalAssignedAt: Date | null;
  lastDemurrageAt: Date | null;
  hopsLeft: number;
  status: ExchangeRightStatus;
  lockedByDealId: string | null;
  ownerHistory: ExchangeRightOwnerHistoryEntry[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ExchangeRight {
  private constructor(private state: ExchangeRightSnapshot) {}

  static restore(snapshot: ExchangeRightSnapshot): ExchangeRight {
    validateSnapshot(snapshot);
    return new ExchangeRight(cloneSnapshot(snapshot));
  }

  assignNominal(nominal: Rubles, floor: Rubles, now: Date): void {
    if (this.state.status !== 'awaiting_nominal') {
      throw new UzzConflictError('RIGHT_NOMINAL_ALREADY_ASSIGNED');
    }
    if (nominal.value < floor.value) {
      throw new UzzValidationError('RIGHT_NOMINAL_BELOW_FLOOR');
    }

    this.state.nominalRub = nominal.value;
    this.state.nominalAssignedAt = new Date(now);
    this.state.lastDemurrageAt = new Date(now);
    this.state.status = 'active';
    this.state.updatedAt = new Date(now);
  }

  promoteAfterIdentityLink(now: Date): void {
    if (this.state.status !== 'holding') return;
    this.state.status = 'awaiting_nominal';
    this.state.updatedAt = new Date(now);
  }

  applyDemurrage(nominal: Rubles, processedAt: Date): void {
    if (
      this.state.status !== 'active' &&
      this.state.status !== 'in_deal'
    ) {
      throw new UzzConflictError('RIGHT_NOT_DEMURRAGEABLE');
    }
    if (this.state.nominalRub === null || nominal.value > this.state.nominalRub) {
      throw new UzzValidationError('RIGHT_DEMURRAGE_CANNOT_INCREASE_NOMINAL');
    }

    this.state.nominalRub = nominal.value;
    this.state.lastDemurrageAt = new Date(processedAt);
    this.state.updatedAt = new Date(processedAt);
  }

  lockForDeal(dealId: string, now: Date): void {
    requireId(dealId, 'DEAL_ID_INVALID');
    if (this.state.lockedByDealId === dealId && this.state.status === 'in_deal') {
      return;
    }
    if (this.state.status !== 'active' || this.state.lockedByDealId !== null) {
      throw new UzzConflictError('RIGHT_ALREADY_LOCKED');
    }

    this.state.status = 'in_deal';
    this.state.lockedByDealId = dealId;
    this.state.updatedAt = new Date(now);
  }

  unlockAfterDeal(dealId: string, now: Date): void {
    this.requireDealLock(dealId);
    this.state.status = 'active';
    this.state.lockedByDealId = null;
    this.state.updatedAt = new Date(now);
  }

  releaseAfterDeal(dealId: string, nextOwnerId: string, now: Date): void {
    this.requireDealLock(dealId);
    requireId(nextOwnerId, 'RIGHT_OWNER_ID_INVALID');
    if (this.state.hopsLeft <= 0) {
      throw new UzzConflictError('RIGHT_ALREADY_EXHAUSTED');
    }

    this.state.hopsLeft -= 1;
    this.state.ownerId = nextOwnerId;
    this.state.lockedByDealId = null;
    this.state.status = this.state.hopsLeft === 0 ? 'exhausted' : 'active';
    this.state.ownerHistory.push({
      userId: nextOwnerId,
      at: new Date(now),
      reason: 'deal_closed',
    });
    this.state.updatedAt = new Date(now);
  }

  snapshot(): ExchangeRightSnapshot {
    return cloneSnapshot(this.state);
  }

  private requireDealLock(dealId: string): void {
    if (
      this.state.status !== 'in_deal' ||
      this.state.lockedByDealId !== dealId
    ) {
      throw new UzzConflictError('RIGHT_DEAL_LOCK_MISMATCH');
    }
  }
}

function validateSnapshot(snapshot: ExchangeRightSnapshot): void {
  requireId(snapshot.id, 'RIGHT_ID_INVALID');
  requireId(snapshot.communityId, 'RIGHT_COMMUNITY_ID_INVALID');
  requireId(snapshot.ownerId, 'RIGHT_OWNER_ID_INVALID');
  requireId(snapshot.sourcePublicationId, 'RIGHT_SOURCE_ID_INVALID');
  if (!Number.isSafeInteger(snapshot.hopsLeft) || snapshot.hopsLeft < 0) {
    throw new UzzValidationError('RIGHT_HOPS_INVALID');
  }
  if (!Number.isSafeInteger(snapshot.version) || snapshot.version < 0) {
    throw new UzzValidationError('RIGHT_VERSION_INVALID');
  }
  if (snapshot.nominalRub !== null) {
    Rubles.create(snapshot.nominalRub);
  }
  if (snapshot.status === 'in_deal' && !snapshot.lockedByDealId) {
    throw new UzzValidationError('RIGHT_DEAL_LOCK_REQUIRED');
  }
  if (snapshot.status !== 'in_deal' && snapshot.lockedByDealId !== null) {
    throw new UzzValidationError('RIGHT_DEAL_LOCK_UNEXPECTED');
  }
  if (snapshot.status === 'exhausted' && snapshot.hopsLeft !== 0) {
    throw new UzzValidationError('RIGHT_EXHAUSTED_WITH_HOPS');
  }
  if (snapshot.hopsLeft === 0 && snapshot.status !== 'exhausted') {
    throw new UzzValidationError('RIGHT_ZERO_HOPS_NOT_EXHAUSTED');
  }
}

function requireId(value: string, code: string): void {
  if (!value.trim()) {
    throw new UzzValidationError(code);
  }
}

function cloneSnapshot(snapshot: ExchangeRightSnapshot): ExchangeRightSnapshot {
  return {
    ...snapshot,
    nominalAssignedAt: snapshot.nominalAssignedAt
      ? new Date(snapshot.nominalAssignedAt)
      : null,
    lastDemurrageAt: snapshot.lastDemurrageAt
      ? new Date(snapshot.lastDemurrageAt)
      : null,
    ownerHistory: snapshot.ownerHistory.map((entry) => ({
      ...entry,
      at: new Date(entry.at),
    })),
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
  };
}
