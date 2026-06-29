import { telegramChatIdLookupVariants } from './telegram-chat-id.util';

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
