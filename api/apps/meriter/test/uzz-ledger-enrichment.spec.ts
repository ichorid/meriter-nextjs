import {
  buildLedgerContext,
  collectLedgerRefs,
  LedgerDealInfo,
  resolveLedgerCounterpartyId,
} from '../src/application/uzz/ledger-enrichment';
import { UzzLedgerEntry } from '../src/application/uzz/ports/uzz-repositories';

const NOW = new Date('2026-08-27T00:00:00Z');

function entry(overrides: Partial<UzzLedgerEntry>): UzzLedgerEntry {
  return {
    id: 'entry-1',
    operationId: 'op-1',
    communityId: 'community-1',
    userId: 'user-1',
    type: 'thanks_received',
    amount: 3,
    createdAt: NOW,
    metadata: {},
    ...overrides,
  };
}

const DEAL: LedgerDealInfo = {
  id: 'deal-1',
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  listingTitle: 'Помощь с математикой',
};

describe('UZZ ledger enrichment', () => {
  it('collects unique deal and publication references', () => {
    const refs = collectLedgerRefs([
      entry({ id: 'a', metadata: { dealId: 'deal-1' } }),
      entry({ id: 'b', metadata: { dealId: 'deal-1', publicationId: 'pub-1' } }),
      entry({ id: 'c', metadata: {} }),
      entry({ id: 'd', metadata: undefined }),
    ]);
    expect(refs).toEqual({ dealIds: ['deal-1'], publicationIds: ['pub-1'] });
  });

  it('prefers explicit counterparty metadata over the deal sides', () => {
    const row = entry({
      userId: 'buyer-1',
      metadata: { dealId: 'deal-1', counterpartyId: 'someone-else' },
    });
    expect(resolveLedgerCounterpartyId(row, DEAL)).toBe('someone-else');
  });

  it.each([
    ['recipientId', { recipientId: 'seller-1' }],
    ['senderId', { senderId: 'buyer-1' }],
  ])('uses %s from transfer metadata', (_label, metadata) => {
    expect(resolveLedgerCounterpartyId(entry({ metadata }), undefined))
      .toBe(Object.values(metadata)[0]);
  });

  it('derives the counterparty as the other side of the deal', () => {
    expect(resolveLedgerCounterpartyId(
      entry({ userId: 'buyer-1', metadata: { dealId: 'deal-1' } }),
      DEAL,
    )).toBe('seller-1');
    expect(resolveLedgerCounterpartyId(
      entry({ userId: 'seller-1', metadata: { dealId: 'deal-1' } }),
      DEAL,
    )).toBe('buyer-1');
  });

  it('leaves system rows without a counterparty', () => {
    expect(resolveLedgerCounterpartyId(
      entry({ userId: 'system', metadata: { dealId: 'deal-1' } }),
      DEAL,
    )).toBeUndefined();
  });

  it('builds a full context for a deal-linked row', () => {
    const context = buildLedgerContext(
      entry({ userId: 'buyer-1', type: 'fee_reserved', metadata: { dealId: 'deal-1' } }),
      new Map([[DEAL.id, DEAL]]),
      new Map([['seller-1', 'Айшат']]),
      new Map(),
    );
    expect(context).toEqual({
      dealId: 'deal-1',
      counterpartyId: 'seller-1',
      counterpartyName: 'Айшат',
      listingTitle: 'Помощь с математикой',
      publicationId: undefined,
      publicationTitle: undefined,
    });
  });

  it('resolves the publication title for an emission row', () => {
    const context = buildLedgerContext(
      entry({ type: 'right_emitted', amount: 0, metadata: { publicationId: 'pub-1' } }),
      new Map(),
      new Map(),
      new Map([['pub-1', 'Заслуга тест 1']]),
    );
    expect(context).toMatchObject({
      publicationId: 'pub-1',
      publicationTitle: 'Заслуга тест 1',
    });
  });

  it('returns undefined for a bare legacy row', () => {
    expect(buildLedgerContext(
      entry({ metadata: undefined }),
      new Map(),
      new Map(),
      new Map(),
    )).toBeUndefined();
  });
});
