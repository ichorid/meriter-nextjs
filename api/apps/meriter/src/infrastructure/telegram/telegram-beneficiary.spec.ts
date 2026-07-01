import {
  formatTelegramBeneficiaryNotFoundError,
  formatTelegramBeneficiarySelfError,
  parseInlineBeneficiaryFromMessage,
  resolveTelegramPublicationBeneficiary,
  stripInlineBeneficiaryMarkers,
} from './telegram-beneficiary';

describe('telegram-beneficiary', () => {
  describe('stripInlineBeneficiaryMarkers', () => {
    it('removes legacy /ben: and для @user', () => {
      expect(stripInlineBeneficiaryMarkers('#заслуга /ben:@ivan помог')).toBe('#заслуга помог');
      expect(stripInlineBeneficiaryMarkers('#заслуга для @ivan: помог')).toBe('#заслуга помог');
    });
  });

  describe('parseInlineBeneficiaryFromMessage', () => {
    it('parses legacy /ben:@username', () => {
      expect(parseInlineBeneficiaryFromMessage('#заслуга /ben:@ivan текст')).toEqual({
        kind: 'username',
        username: 'ivan',
      });
    });

    it('parses для @username', () => {
      expect(parseInlineBeneficiaryFromMessage('#заслуга для @petrov помог')).toEqual({
        kind: 'username',
        username: 'petrov',
      });
    });

    it('prefers text_mention entity over plain-text «для @username»', () => {
      const text = '#заслуга для @prokhortseva спасибо';
      const entities = [
        {
          type: 'text_mention',
          offset: 8,
          length: 12,
          user: { id: 4242, first_name: 'Anna', username: 'prokhortseva' },
        },
      ];
      expect(parseInlineBeneficiaryFromMessage(text, entities)).toEqual({
        kind: 'text_mention',
        telegramId: '4242',
        displayName: 'Anna',
        username: 'prokhortseva',
      });
    });

    it('parses text_mention after для', () => {
      const text = '#заслуга для Иван помог';
      const entities = [
        { type: 'text_mention', offset: 8, length: 4, user: { id: 42, first_name: 'Иван' } },
      ];
      expect(parseInlineBeneficiaryFromMessage(text, entities)).toEqual({
        kind: 'text_mention',
        telegramId: '42',
        displayName: 'Иван',
        username: undefined,
      });
    });
  });

  describe('resolveTelegramPublicationBeneficiary', () => {
    const baseDeps = {
      authorTelegramId: '100',
      tgChatId: '-1001',
      messageText: '#заслуга помог на субботнике',
      isChatMember: jest.fn().mockResolvedValue(true),
      findUserByTelegramId: jest.fn(),
      findUserByUsername: jest.fn(),
      resolveUsernameViaTelegramApi: jest.fn(),
      ensureTelegramUser: jest.fn().mockResolvedValue({ id: 'u2', displayName: 'Иван' }),
      ensureCommunityMember: jest.fn().mockResolvedValue(undefined),
    };

    it('reply path wins over inline', async () => {
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: '#заслуга для @other текст',
        replyToFrom: { id: 200, first_name: 'Пётр' },
      });
      expect(result.error).toBeUndefined();
      expect(result.beneficiary?.telegramId).toBe('200');
      expect(baseDeps.ensureTelegramUser).toHaveBeenCalledWith(
        '200',
        expect.objectContaining({ first_name: 'Пётр' }),
      );
    });

    it('blocks self as beneficiary via reply', async () => {
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        replyToFrom: { id: 100, first_name: 'Self' },
      });
      expect(result.beneficiary).toBeNull();
      expect(result.error).toBe(formatTelegramBeneficiarySelfError());
    });

    it('inline для @user when no reply', async () => {
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: '#заслуга для @ivan помог',
        findUserByUsername: jest.fn().mockResolvedValue({
          id: 'u-ivan',
          telegramId: '300',
          displayName: 'Ivan',
          username: 'ivan',
        }),
      });
      expect(result.beneficiary?.telegramId).toBe('300');
      expect(result.cleanedText).toBe('#заслуга помог');
    });

    it('resolves username via community member lookup', async () => {
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: '#заслуга для @prokhortseva спасибо',
        findUserByUsername: jest.fn().mockResolvedValue(null),
        findCommunityMemberByUsername: jest.fn().mockResolvedValue({
          id: 'u-pro',
          telegramId: '4242',
          displayName: 'Anna',
          username: 'prokhortseva',
        }),
      });
      expect(result.beneficiary?.telegramId).toBe('4242');
      expect(result.error).toBeUndefined();
    });

    it('resolves username via group chat lookup', async () => {
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: '#заслуга для @prokhortseva спасибо',
        findUserByUsername: jest.fn().mockResolvedValue(null),
        findCommunityMemberByUsername: jest.fn().mockResolvedValue(null),
        resolveUsernameInGroupChat: jest.fn().mockResolvedValue({
          id: '7777',
          username: 'prokhortseva',
          firstName: 'Anna',
        }),
      });
      expect(result.beneficiary?.telegramId).toBe('7777');
    });

    it('returns MVP error when username not found', async () => {
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: '#заслуга для @ghost текст',
        findUserByUsername: jest.fn().mockResolvedValue(null),
        resolveUsernameViaTelegramApi: jest.fn().mockResolvedValue(null),
      });
      expect(result.error).toBe(formatTelegramBeneficiaryNotFoundError('@ghost'));
    });
  });
});
