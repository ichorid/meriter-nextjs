import { TelegramUzzNotificationSender } from '../src/infrastructure/uzz/notifications/telegram-uzz-notification.sender';

describe('TelegramUzzNotificationSender', () => {
  it('adds an absolute UZZ link without duplicating slashes', async () => {
    const tgSend = jest.fn().mockResolvedValue(undefined);
    const sender = new TelegramUzzNotificationSender(
      { tgSend } as any,
      { get: jest.fn().mockReturnValue({ uzzWebBaseUrl: 'https://uzz.example.org/' }) } as any,
    );

    await sender.send('event-1', {
      telegramUserId: '1001', text: 'Заявка принята', path: '/deals',
    });

    expect(tgSend).toHaveBeenCalledWith({
      tgChatId: '1001',
      text: 'Заявка принята\n\nhttps://uzz.example.org/deals',
    });
  });
});
