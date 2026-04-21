import {
  meritHistoryCategoryForReferenceType,
  meritHistoryLedgerMultiplier,
  meritHistoryReferenceTypeMatch,
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
});
