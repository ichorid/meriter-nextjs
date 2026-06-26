import {
  shouldUseTelegramInstantWalletMirror,
} from './create-vote.helpers';
import {
  effectiveAllowWithdraw,
  isTelegramLinkedCommunity,
} from '../../../domain/common/helpers/community.helper';

describe('create-vote.helpers (Telegram MVP)', () => {
  describe('isTelegramLinkedCommunity', () => {
    it('returns true when telegramChatId is set', () => {
      expect(isTelegramLinkedCommunity({ telegramChatId: '-100123' })).toBe(true);
    });

    it('returns false for empty or missing chat id', () => {
      expect(isTelegramLinkedCommunity({ telegramChatId: '' })).toBe(false);
      expect(isTelegramLinkedCommunity({})).toBe(false);
      expect(isTelegramLinkedCommunity(null)).toBe(false);
    });
  });

  describe('effectiveAllowWithdraw', () => {
    it('disables withdraw for Telegram-linked communities', () => {
      expect(
        effectiveAllowWithdraw({
          telegramChatId: '-1001',
          settings: { allowWithdraw: true },
        }),
      ).toBe(false);
    });

    it('respects allowWithdraw when not Telegram-linked', () => {
      expect(effectiveAllowWithdraw({ settings: { allowWithdraw: false } })).toBe(false);
      expect(effectiveAllowWithdraw({ settings: { allowWithdraw: true } })).toBe(true);
      expect(effectiveAllowWithdraw({})).toBe(true);
    });
  });

  describe('shouldUseTelegramInstantWalletMirror', () => {
    it('mirrors when community is Telegram-linked and amount is positive', () => {
      expect(
        shouldUseTelegramInstantWalletMirror(
          { telegramChatId: '-1001' },
          { authorId: 'u1' },
          1,
        ),
      ).toBe(true);
    });

    it('does not mirror without publication or zero amount', () => {
      expect(
        shouldUseTelegramInstantWalletMirror({ telegramChatId: '-1001' }, null, 1),
      ).toBe(false);
      expect(
        shouldUseTelegramInstantWalletMirror(
          { telegramChatId: '-1001' },
          { authorId: 'u1' },
          0,
        ),
      ).toBe(false);
    });
  });
});
