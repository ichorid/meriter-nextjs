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

    it('parses mention entity when Telegram sends username without user id', () => {
      const text = '#заслуга для @prokhortseva спасибо';
      const entities = [{ type: 'mention', offset: 13, length: 14 }];
      expect(parseInlineBeneficiaryFromMessage(text, entities)).toEqual({
        kind: 'username',
        username: 'prokhortseva',
        viaMentionEntity: true,
      });
    });

    it('parses #hashtag @username nomination without «для»', () => {
      const text = '#Заслуга @dmitrsosnin Благодарю Дмитрия';
      expect(parseInlineBeneficiaryFromMessage(text)).toEqual({
        kind: 'username',
        username: 'dmitrsosnin',
      });
      expect(stripInlineBeneficiaryMarkers(text)).toBe('#Заслуга Благодарю Дмитрия');
    });

    it('parses #hashtag @username from mention entity', () => {
      const text = '#заслуга @ivan помог';
      const entities = [{ type: 'mention', offset: 9, length: 5 }];
      expect(parseInlineBeneficiaryFromMessage(text, entities)).toEqual({
        kind: 'username',
        username: 'ivan',
        viaMentionEntity: true,
      });
    });

    it('prefers text_mention whose username matches «для @username»', () => {
      const text = '#заслуга для @prokhortseva спасибо';
      const entities = [
        {
          type: 'text_mention',
          offset: 0,
          length: 8,
          user: { id: 111, first_name: 'Other', username: 'other' },
        },
        {
          type: 'text_mention',
          offset: 13,
          length: 14,
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
      const resolveUsernameInGroupChat = jest.fn().mockResolvedValue(null);
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: '#заслуга для @prokhortseva спасибо',
        findUserByUsername: jest.fn().mockResolvedValue(null),
        resolveUsernameInGroupChat,
        findCommunityMemberByUsername: jest.fn().mockResolvedValue({
          id: 'u-pro',
          telegramId: '4242',
          displayName: 'Anna',
          username: 'prokhortseva',
        }),
      });
      expect(result.beneficiary?.telegramId).toBe('4242');
      expect(result.error).toBeUndefined();
      expect(resolveUsernameInGroupChat).toHaveBeenCalledWith('prokhortseva');
    });

    it('prefers group chat lookup before community DB for silent member username', async () => {
      const findCommunityMemberByUsername = jest.fn();
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: '#заслуга для @prokhortseva спасибо',
        findUserByUsername: jest.fn().mockResolvedValue(null),
        resolveUsernameInGroupChat: jest.fn().mockResolvedValue({
          id: '7777',
          username: 'prokhortseva',
          firstName: 'Anna',
        }),
        findCommunityMemberByUsername,
      });
      expect(result.beneficiary?.telegramId).toBe('7777');
      expect(findCommunityMemberByUsername).not.toHaveBeenCalled();
    });

    it('accepts restricted chat members as beneficiaries', async () => {
      const isChatMember = jest.fn().mockResolvedValue(true);
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: '#заслуга для @quiet спасибо',
        findUserByUsername: jest.fn().mockResolvedValue(null),
        resolveUsernameInGroupChat: jest.fn().mockResolvedValue({
          id: '8888',
          username: 'quiet',
          firstName: 'Quiet',
        }),
        isChatMember,
      });
      expect(result.beneficiary?.telegramId).toBe('8888');
      expect(isChatMember).toHaveBeenCalledWith('-1001', '8888');
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

    it('returns mention-without-id hint when Telegram sent mention entity only', async () => {
      const text = '#заслуга для @exegetta текст';
      const entities = [{ type: 'mention', offset: 13, length: 9 }];
      const result = await resolveTelegramPublicationBeneficiary({
        ...baseDeps,
        messageText: text,
        entities,
        findUserByUsername: jest.fn().mockResolvedValue(null),
        resolveUsernameInGroupChat: jest.fn().mockResolvedValue(null),
        resolveUsernameViaTelegramApi: jest.fn().mockResolvedValue(null),
      });
      expect(result.error).toBe(
        formatTelegramBeneficiaryNotFoundError('@exegetta', { mentionWithoutId: true }),
      );
      expect(result.error).toContain('/start');
    });
  });
});
