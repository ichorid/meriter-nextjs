import {
  expandTelegramChatIds,
  isTelegramGroupChatId,
  telegramChatIdLookupVariants,
  telegramGroupSendNotificationParams,
} from './telegram-chat-id.util';

describe('isTelegramGroupChatId', () => {
  it('treats negative ids as group chats', () => {
    expect(isTelegramGroupChatId('-1001234567890')).toBe(true);
    expect(isTelegramGroupChatId(-1001234567890)).toBe(true);
  });

  it('treats positive user ids as private chats', () => {
    expect(isTelegramGroupChatId('424242')).toBe(false);
    expect(isTelegramGroupChatId(424242)).toBe(false);
  });
});

describe('telegramGroupSendNotificationParams', () => {
  it('enables disable_notification for groups only', () => {
    expect(telegramGroupSendNotificationParams('-1001')).toEqual({
      disable_notification: true,
    });
    expect(telegramGroupSendNotificationParams('900001')).toEqual({});
  });
});

describe('telegramChatIdLookupVariants', () => {
  it('includes supergroup and legacy negative ids', () => {
    expect(telegramChatIdLookupVariants('-1001234567890')).toEqual(
      expect.arrayContaining(['-1001234567890', '-1234567890']),
    );
  });

  it('adds supergroup prefix for legacy group id', () => {
    expect(telegramChatIdLookupVariants('-1234567890')).toEqual(
      expect.arrayContaining(['-1234567890', '-1001234567890']),
    );
  });
});

describe('expandTelegramChatIds', () => {
  it('merges primary id, variants, and explicit legacy aliases', () => {
    expect(
      expandTelegramChatIds('-1004324573589', ['-5565524009']),
    ).toEqual(
      expect.arrayContaining(['-1004324573589', '-4324573589', '-5565524009']),
    );
  });
});
