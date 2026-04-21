import {
  buildMeritHistoryTransactionMatch,
  meritHistoryCategoryForReferenceType,
  meritHistoryLedgerMultiplier,
  meritHistoryReferenceTypeMatch,
  meritHistoryUtcCalendarRange,
} from '../src/domain/common/helpers/wallet-transaction-history';

describe('wallet-transaction-history', () => {
  describe('meritHistoryCategoryForReferenceType', () => {
    it.each([
      ['merit_transfer', 'peer_transfer'],
      ['investment', 'investment'],
      ['investment_distribution', 'investment'],
      ['tappalka_reward', 'tappalka'],
      ['publication_vote', 'voting'],
      ['welcome_merits', 'welcome_and_system'],
      ['publication_withdrawal', 'withdrawals'],
      ['forward_proposal', 'fees_and_forward'],
      ['unknown_xyz', 'other'],
      ['', 'other'],
    ] as const)('maps %s → %s', (referenceType, expected) => {
      expect(meritHistoryCategoryForReferenceType(referenceType)).toBe(expected);
    });
  });

  describe('meritHistoryReferenceTypeMatch', () => {
    it('returns null for all', () => {
      expect(meritHistoryReferenceTypeMatch('all')).toBeNull();
    });

    it('builds $in for peer_transfer', () => {
      expect(meritHistoryReferenceTypeMatch('peer_transfer')).toEqual({
        referenceType: { $in: ['merit_transfer'] },
      });
    });

    it('builds $or for other', () => {
      const m = meritHistoryReferenceTypeMatch('other');
      expect(m).toMatchObject({ $or: expect.any(Array) });
    });
  });

  describe('meritHistoryLedgerMultiplier', () => {
    it('treats publication_withdrawal as incoming despite withdrawal type', () => {
      expect(
        meritHistoryLedgerMultiplier({
          type: 'withdrawal',
          referenceType: 'publication_withdrawal',
        }),
      ).toBe(1);
    });

    it('uses deposit as incoming', () => {
      expect(meritHistoryLedgerMultiplier({ type: 'deposit', referenceType: 'welcome_merits' })).toBe(
        1,
      );
    });
  });

  describe('meritHistoryUtcCalendarRange', () => {
    it('covers periodDays inclusive UTC days ending on anchor date', () => {
      const anchor = new Date(Date.UTC(2026, 3, 21, 15, 30, 0));
      const r = meritHistoryUtcCalendarRange(7, anchor);
      expect(r.fromInclusive.toISOString()).toBe('2026-04-15T00:00:00.000Z');
      expect(r.toExclusive.toISOString()).toBe('2026-04-22T00:00:00.000Z');
    });
  });

  describe('buildMeritHistoryTransactionMatch', () => {
    it('merges walletId, category, and createdAt range', () => {
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-01-08T00:00:00.000Z');
      expect(buildMeritHistoryTransactionMatch('w1', 'peer_transfer', { fromInclusive: from, toExclusive: to })).toEqual({
        walletId: 'w1',
        referenceType: { $in: ['merit_transfer'] },
        createdAt: { $gte: from, $lt: to },
      });
    });

    it('omits reference filter for all', () => {
      expect(buildMeritHistoryTransactionMatch('w1', 'all')).toEqual({ walletId: 'w1' });
    });

    it('omits createdAt when date range is omitted (full ledger)', () => {
      expect(buildMeritHistoryTransactionMatch('w1', 'peer_transfer', undefined)).toEqual({
        walletId: 'w1',
        referenceType: { $in: ['merit_transfer'] },
      });
    });
  });
});
