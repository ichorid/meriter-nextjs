import {
  UzzConflictError,
  UzzExpiredError,
  UzzForbiddenError,
  UzzValidationError,
} from '../errors';
import { MeritAmount } from '../value-objects/merit-amount';
import { Rubles } from '../value-objects/rubles';
import { ListingDeliveryMode } from './listing';

export type DealStatus =
  | 'requested'
  | 'accepted'
  | 'completed_by_seller'
  | 'closed'
  | 'rejected'
  | 'cancelled';

export interface DealListingSnapshot {
  title: string;
  priceRub: number;
  deliveryMode: ListingDeliveryMode;
  locationText: string;
}

export interface DealContactSnapshot {
  telegramUsername: string;
}

export interface RequestDealInput {
  id: string;
  communityId: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  exchangeRightId: string;
  requestMessage: string;
  listingSnapshot: DealListingSnapshot;
  requestedDeadlineAt: Date | null;
  requestExpiresAt: Date;
  now: Date;
}

export interface DealSnapshot {
  id: string;
  communityId: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  exchangeRightId: string;
  status: DealStatus;
  requestMessage: string;
  listingSnapshot: DealListingSnapshot;
  requestedDeadlineAt: Date | null;
  agreedDeadlineAt: Date | null;
  acceptedNominalRub: number | null;
  dealAmountRub: number | null;
  requestExpiresAt: Date;
  fulfillmentExpiresAt: Date | null;
  confirmationExpiresAt: Date | null;
  buyerContact: DealContactSnapshot | null;
  sellerContact: DealContactSnapshot | null;
  feeReserved: boolean;
  feeSourceCommunityId: string | null;
  adminResolutionReason: string | null;
  requestedAt: Date;
  acceptedAt: Date | null;
  completedBySellerAt: Date | null;
  closedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  buyerThankedAt: Date | null;
  sellerThankedAt: Date | null;
  buyerThanksComment: string | null;
  sellerThanksComment: string | null;
  buyerThanksMerits: number | null;
  sellerThanksMerits: number | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Deal {
  private constructor(private state: DealSnapshot) {}

  static request(input: RequestDealInput): Deal {
    if (input.buyerId === input.sellerId) {
      throw new UzzValidationError('DEAL_SELF_REQUEST_FORBIDDEN');
    }
    if (input.requestExpiresAt.getTime() <= input.now.getTime()) {
      throw new UzzValidationError('DEAL_REQUEST_EXPIRY_INVALID');
    }

    const now = new Date(input.now);
    return Deal.restore({
      id: requireText(input.id, 1, 200, 'DEAL_ID_INVALID'),
      communityId: requireText(
        input.communityId,
        1,
        200,
        'DEAL_COMMUNITY_ID_INVALID',
      ),
      buyerId: requireText(input.buyerId, 1, 200, 'DEAL_BUYER_ID_INVALID'),
      sellerId: requireText(
        input.sellerId,
        1,
        200,
        'DEAL_SELLER_ID_INVALID',
      ),
      listingId: requireText(
        input.listingId,
        1,
        200,
        'DEAL_LISTING_ID_INVALID',
      ),
      exchangeRightId: requireText(
        input.exchangeRightId,
        1,
        200,
        'DEAL_RIGHT_ID_INVALID',
      ),
      status: 'requested',
      requestMessage: requireText(
        input.requestMessage,
        1,
        1000,
        'DEAL_REQUEST_MESSAGE_INVALID',
      ),
      listingSnapshot: normalizeListingSnapshot(input.listingSnapshot),
      requestedDeadlineAt: cloneDate(input.requestedDeadlineAt),
      agreedDeadlineAt: null,
      acceptedNominalRub: null,
      dealAmountRub: null,
      requestExpiresAt: new Date(input.requestExpiresAt),
      fulfillmentExpiresAt: null,
      confirmationExpiresAt: null,
      buyerContact: null,
      sellerContact: null,
      feeReserved: false,
      feeSourceCommunityId: null,
      adminResolutionReason: null,
      requestedAt: now,
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
    });
  }

  static restore(snapshot: DealSnapshot): Deal {
    validateSnapshot(snapshot);
    return new Deal(cloneSnapshot(snapshot));
  }

  accept(input: {
    sellerId: string;
    acceptedNominal: Rubles;
    agreedDeadlineAt: Date | null;
    fulfillmentExpiresAt: Date;
    buyerContact: DealContactSnapshot;
    sellerContact: DealContactSnapshot;
    now: Date;
  }): void {
    this.requireActor(input.sellerId, this.state.sellerId);
    this.requireStatus('requested');
    this.requireRequestOpen(input.now);
    if (input.fulfillmentExpiresAt.getTime() <= input.now.getTime()) {
      throw new UzzValidationError('DEAL_FULFILLMENT_EXPIRY_INVALID');
    }

    this.state.status = 'accepted';
    this.state.acceptedNominalRub = input.acceptedNominal.value;
    this.state.agreedDeadlineAt = cloneDate(input.agreedDeadlineAt);
    this.state.fulfillmentExpiresAt = new Date(input.fulfillmentExpiresAt);
    this.state.buyerContact = normalizeContact(input.buyerContact);
    this.state.sellerContact = normalizeContact(input.sellerContact);
    this.state.acceptedAt = new Date(input.now);
    this.state.updatedAt = new Date(input.now);
  }

  reserveFee(sourceCommunityId: string, now: Date): void {
    this.requireStatus('requested');
    if (this.state.feeReserved) {
      throw new UzzConflictError('DEAL_FEE_ALREADY_RESERVED');
    }
    this.state.feeReserved = true;
    this.state.feeSourceCommunityId = requireText(
      sourceCommunityId,
      1,
      200,
      'DEAL_FEE_SOURCE_INVALID',
    );
    this.state.updatedAt = new Date(now);
  }

  clearReservedFee(now: Date): void {
    if (!this.state.feeReserved || !this.state.feeSourceCommunityId) {
      throw new UzzConflictError('DEAL_FEE_NOT_RESERVED');
    }
    this.state.feeReserved = false;
    this.state.updatedAt = new Date(now);
  }

  reject(sellerId: string, now: Date): void {
    this.requireActor(sellerId, this.state.sellerId);
    this.requireStatus('requested');
    this.requireRequestOpen(now);
    this.state.status = 'rejected';
    this.state.rejectedAt = new Date(now);
    this.state.updatedAt = new Date(now);
  }

  cancel(buyerId: string, now: Date): void {
    this.requireActor(buyerId, this.state.buyerId);
    this.requireStatus('requested');
    this.requireRequestOpen(now);
    this.state.status = 'cancelled';
    this.state.cancelledAt = new Date(now);
    this.state.updatedAt = new Date(now);
  }

  markCompleted(
    sellerId: string,
    now: Date,
    confirmationExpiresAt: Date | null = null,
  ): void {
    this.requireActor(sellerId, this.state.sellerId);
    this.requireStatus('accepted');
    this.requireFulfillmentOpen(now);
    if (
      confirmationExpiresAt &&
      confirmationExpiresAt.getTime() <= now.getTime()
    ) {
      throw new UzzValidationError('DEAL_CONFIRMATION_EXPIRY_INVALID');
    }

    this.state.status = 'completed_by_seller';
    this.state.completedBySellerAt = new Date(now);
    this.state.confirmationExpiresAt = cloneDate(confirmationExpiresAt);
    this.state.updatedAt = new Date(now);
  }

  close(buyerId: string, amount: Rubles, now: Date): void {
    this.requireActor(buyerId, this.state.buyerId);
    this.requireStatus('completed_by_seller');
    this.state.status = 'closed';
    this.state.dealAmountRub = amount.value;
    this.state.closedAt = new Date(now);
    this.state.updatedAt = new Date(now);
  }

  resolveByAdmin(
    outcome: 'close' | 'cancel',
    reason: string,
    amount: Rubles | null,
    now: Date,
  ): void {
    const normalizedReason = requireText(
      reason,
      10,
      1000,
      'ADMIN_RESOLUTION_REASON_INVALID',
    );
    if (!['requested', 'accepted', 'completed_by_seller'].includes(this.state.status)) {
      throw new UzzConflictError('DEAL_STATUS_INVALID');
    }
    if (outcome === 'close') {
      if (this.state.status === 'requested' || !amount) {
        throw new UzzConflictError('DEAL_CANNOT_ADMIN_CLOSE');
      }
      this.state.status = 'closed';
      this.state.dealAmountRub = amount.value;
      this.state.closedAt = new Date(now);
    } else {
      this.state.status = 'cancelled';
      this.state.cancelledAt = new Date(now);
    }
    this.state.adminResolutionReason = normalizedReason;
    this.state.updatedAt = new Date(now);
  }

  thank(input: {
    actorId: string;
    merits: MeritAmount | null;
    comment: string;
    now: Date;
  }): void {
    this.requireStatus('closed');
    const comment = optionalText(
      input.comment,
      1000,
      'DEAL_THANKS_COMMENT_INVALID',
    );
    if (!input.merits && !comment) {
      throw new UzzValidationError('DEAL_THANKS_EMPTY');
    }

    if (input.actorId === this.state.buyerId) {
      if (this.state.buyerThankedAt) {
        throw new UzzConflictError('DEAL_BUYER_ALREADY_THANKED');
      }
      this.state.buyerThankedAt = new Date(input.now);
      this.state.buyerThanksComment = comment || null;
      this.state.buyerThanksMerits = input.merits?.value ?? null;
    } else if (input.actorId === this.state.sellerId) {
      if (this.state.sellerThankedAt) {
        throw new UzzConflictError('DEAL_SELLER_ALREADY_THANKED');
      }
      this.state.sellerThankedAt = new Date(input.now);
      this.state.sellerThanksComment = comment || null;
      this.state.sellerThanksMerits = input.merits?.value ?? null;
    } else {
      throw new UzzForbiddenError('DEAL_ACTOR_FORBIDDEN');
    }
    this.state.updatedAt = new Date(input.now);
  }

  snapshot(): DealSnapshot {
    return cloneSnapshot(this.state);
  }

  private requireStatus(expected: DealStatus): void {
    if (this.state.status !== expected) {
      throw new UzzConflictError('DEAL_STATUS_INVALID');
    }
  }

  private requireActor(actual: string, expected: string): void {
    if (actual !== expected) {
      throw new UzzForbiddenError('DEAL_ACTOR_FORBIDDEN');
    }
  }

  private requireRequestOpen(now: Date): void {
    if (now.getTime() >= this.state.requestExpiresAt.getTime()) {
      throw new UzzExpiredError('DEAL_REQUEST_EXPIRED');
    }
  }

  private requireFulfillmentOpen(now: Date): void {
    if (
      !this.state.fulfillmentExpiresAt ||
      now.getTime() >= this.state.fulfillmentExpiresAt.getTime()
    ) {
      throw new UzzExpiredError('DEAL_FULFILLMENT_EXPIRED');
    }
  }
}

function validateSnapshot(snapshot: DealSnapshot): void {
  requireText(snapshot.id, 1, 200, 'DEAL_ID_INVALID');
  requireText(snapshot.communityId, 1, 200, 'DEAL_COMMUNITY_ID_INVALID');
  requireText(snapshot.buyerId, 1, 200, 'DEAL_BUYER_ID_INVALID');
  requireText(snapshot.sellerId, 1, 200, 'DEAL_SELLER_ID_INVALID');
  requireText(snapshot.listingId, 1, 200, 'DEAL_LISTING_ID_INVALID');
  requireText(snapshot.exchangeRightId, 1, 200, 'DEAL_RIGHT_ID_INVALID');
  requireText(snapshot.requestMessage, 1, 1000, 'DEAL_REQUEST_MESSAGE_INVALID');
  normalizeListingSnapshot(snapshot.listingSnapshot);
  if (!Number.isSafeInteger(snapshot.version) || snapshot.version < 0) {
    throw new UzzValidationError('DEAL_VERSION_INVALID');
  }
  if (snapshot.acceptedNominalRub !== null) {
    Rubles.create(snapshot.acceptedNominalRub);
  }
  if (snapshot.dealAmountRub !== null) {
    Rubles.create(snapshot.dealAmountRub);
  }
}

function normalizeListingSnapshot(
  snapshot: DealListingSnapshot,
): DealListingSnapshot {
  if (!['online', 'offline', 'both'].includes(snapshot.deliveryMode)) {
    throw new UzzValidationError('DEAL_LISTING_DELIVERY_MODE_INVALID');
  }
  return {
    title: requireText(snapshot.title, 3, 120, 'DEAL_LISTING_TITLE_INVALID'),
    priceRub: Rubles.create(snapshot.priceRub).value,
    deliveryMode: snapshot.deliveryMode,
    locationText: optionalText(
      snapshot.locationText,
      160,
      'DEAL_LISTING_LOCATION_INVALID',
    ),
  };
}

function normalizeContact(contact: DealContactSnapshot): DealContactSnapshot {
  return {
    telegramUsername: requireText(
      contact.telegramUsername,
      1,
      64,
      'DEAL_CONTACT_INVALID',
    ).replace(/^@/, ''),
  };
}

function requireText(
  value: string,
  min: number,
  max: number,
  code: string,
): string {
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  if (length < min || length > max) {
    throw new UzzValidationError(code);
  }
  return normalized;
}

function optionalText(value: string, max: number, code: string): string {
  return requireText(value, 0, max, code);
}

function cloneDate(value: Date | null): Date | null {
  return value ? new Date(value) : null;
}

function cloneSnapshot(snapshot: DealSnapshot): DealSnapshot {
  return {
    ...snapshot,
    listingSnapshot: { ...snapshot.listingSnapshot },
    requestedDeadlineAt: cloneDate(snapshot.requestedDeadlineAt),
    agreedDeadlineAt: cloneDate(snapshot.agreedDeadlineAt),
    requestExpiresAt: new Date(snapshot.requestExpiresAt),
    fulfillmentExpiresAt: cloneDate(snapshot.fulfillmentExpiresAt),
    confirmationExpiresAt: cloneDate(snapshot.confirmationExpiresAt),
    buyerContact: snapshot.buyerContact ? { ...snapshot.buyerContact } : null,
    sellerContact: snapshot.sellerContact ? { ...snapshot.sellerContact } : null,
    requestedAt: new Date(snapshot.requestedAt),
    acceptedAt: cloneDate(snapshot.acceptedAt),
    completedBySellerAt: cloneDate(snapshot.completedBySellerAt),
    closedAt: cloneDate(snapshot.closedAt),
    rejectedAt: cloneDate(snapshot.rejectedAt),
    cancelledAt: cloneDate(snapshot.cancelledAt),
    buyerThankedAt: cloneDate(snapshot.buyerThankedAt),
    sellerThankedAt: cloneDate(snapshot.sellerThankedAt),
    createdAt: new Date(snapshot.createdAt),
    updatedAt: new Date(snapshot.updatedAt),
  };
}
