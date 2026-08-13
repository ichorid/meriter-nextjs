import { Deal } from '../src/domain/uzz/entities/deal';
import { ExchangeRight } from '../src/domain/uzz/entities/exchange-right';
import { Listing } from '../src/domain/uzz/entities/listing';
import {
  UzzConflictError,
  UzzValidationError,
} from '../src/domain/uzz/errors';
import { applyDemurrage } from '../src/domain/uzz/policies/demurrage-policy';
import { evaluatePurchaseGate } from '../src/domain/uzz/policies/purchase-gate-policy';
import { MeritAmount } from '../src/domain/uzz/value-objects/merit-amount';
import { Rubles } from '../src/domain/uzz/value-objects/rubles';

const NOW = new Date('2026-08-14T00:00:00.000Z');

function activeRight(
  patch: Partial<Parameters<typeof ExchangeRight.restore>[0]> = {},
) {
  return {
    id: 'right-1',
    communityId: 'community-1',
    ownerId: 'buyer-1',
    sourcePublicationId: 'publication-1',
    nominalRub: 100,
    nominalAssignedAt: NOW,
    lastDemurrageAt: NOW,
    hopsLeft: 2,
    status: 'active' as const,
    lockedByDealId: null,
    ownerHistory: [],
    version: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

describe('UZZ domain', () => {
  describe('money value objects', () => {
    it.each([0, -1, 10.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid ruble amount %p',
      (value) => {
        expect(() => Rubles.create(value)).toThrow(UzzValidationError);
      },
    );

    it.each([0, -1, 0.1, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid merit amount %p',
      (value) => {
        expect(() => MeritAmount.create(value)).toThrow(UzzValidationError);
      },
    );

    it('preserves a positive whole amount', () => {
      expect(Rubles.create(125).value).toBe(125);
      expect(MeritAmount.create(3).value).toBe(3);
    });
  });

  describe('demurrage', () => {
    it('never increases a nominal that is already below a raised floor', () => {
      expect(
        applyDemurrage({
          nominalRub: 80,
          floorRub: 100,
          rateRubPerDay: 10,
          days: 1,
        }),
      ).toEqual({ nominalRub: 70, appliedDays: 1 });
    });

    it('stops at the floor for a right that started above it', () => {
      expect(
        applyDemurrage({
          nominalRub: 150,
          floorRub: 100,
          rateRubPerDay: 30,
          days: 3,
        }),
      ).toEqual({ nominalRub: 100, appliedDays: 3 });
    });
  });

  describe('exchange right', () => {
    it('keeps a right active at the floor while hops remain', () => {
      const right = ExchangeRight.restore(activeRight());

      right.lockForDeal('deal-1', NOW);
      right.releaseAfterDeal('deal-1', 'seller-1', NOW);

      expect(right.snapshot()).toMatchObject({
        ownerId: 'seller-1',
        nominalRub: 100,
        status: 'active',
        hopsLeft: 1,
        lockedByDealId: null,
      });
    });

    it('cannot be locked by two deals', () => {
      const right = ExchangeRight.restore(activeRight());
      right.lockForDeal('deal-1', NOW);

      expect(() => right.lockForDeal('deal-2', NOW)).toThrow(UzzConflictError);
    });
  });

  describe('listing', () => {
    it('normalizes user-entered text and exposes a valid snapshot', () => {
      const listing = Listing.create({
        id: 'listing-1',
        communityId: 'community-1',
        authorId: 'seller-1',
        title: '  Помогу настроить отчёт  ',
        description: '  За один созвон  ',
        priceRub: 500,
        deliveryMode: 'online',
        locationText: '  Zoom  ',
        durationText: '  60 минут  ',
        availabilityText: '  По будням  ',
        now: NOW,
      });

      expect(listing.snapshot()).toMatchObject({
        title: 'Помогу настроить отчёт',
        description: 'За один созвон',
        priceRub: 500,
        locationText: 'Zoom',
        durationText: '60 минут',
        availabilityText: 'По будням',
        active: true,
      });
    });

    it.each(['', '  ', 'ab'])(
      'rejects a blank or too-short title %p',
      (title) => {
        expect(() =>
          Listing.create({
            id: 'listing-1',
            communityId: 'community-1',
            authorId: 'seller-1',
            title,
            description: '',
            priceRub: 100,
            deliveryMode: 'offline',
            locationText: '',
            durationText: '',
            availabilityText: '',
            now: NOW,
          }),
        ).toThrow(UzzValidationError);
      },
    );
  });

  describe('deal', () => {
    it('does not allow completion before seller acceptance', () => {
      const deal = Deal.request({
        id: 'deal-1',
        communityId: 'community-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-1',
        exchangeRightId: 'right-1',
        requestMessage: 'Нужна помощь с отчётом',
        listingSnapshot: {
          title: 'Помогу настроить отчёт',
          priceRub: 500,
          deliveryMode: 'online',
          locationText: 'Zoom',
        },
        requestedDeadlineAt: null,
        requestExpiresAt: new Date('2026-08-16T00:00:00.000Z'),
        now: NOW,
      });

      expect(() => deal.markCompleted('seller-1', NOW)).toThrow(
        UzzConflictError,
      );
    });
  });

  describe('purchase gate', () => {
    it('nudges but allows purchase in the default soft mode', () => {
      expect(
        evaluatePurchaseGate({ mode: 'nudge', activeListingCount: 1, minimum: 3 }),
      ).toEqual({ allowed: true, nudge: true, missingListingCount: 2 });
    });

    it('blocks purchase in strict mode until the minimum is reached', () => {
      expect(
        evaluatePurchaseGate({
          mode: 'require_min_lots',
          activeListingCount: 1,
          minimum: 3,
        }),
      ).toEqual({ allowed: false, nudge: false, missingListingCount: 2 });
    });
  });
});
