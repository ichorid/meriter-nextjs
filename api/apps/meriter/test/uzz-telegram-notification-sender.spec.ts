import {
  TelegramUzzNotificationSender,
  UZZ_TELEGRAM_DELIVERY_SEMANTICS,
} from '../src/infrastructure/uzz/notifications/telegram-uzz-notification.sender';

describe('TelegramUzzNotificationSender', () => {
  it('documents at-least-once delivery and the crash-after-send duplicate window', () => {
    expect(UZZ_TELEGRAM_DELIVERY_SEMANTICS.mode).toBe('at-least-once');
    expect(UZZ_TELEGRAM_DELIVERY_SEMANTICS.residualDuplicateWindow).toBe(
      'crash after Telegram send succeeds and before outbox ack',
    );
    const documented = JSON.stringify(UZZ_TELEGRAM_DELIVERY_SEMANTICS);
    expect(documented).not.toMatch(/exactly-once/i);
    expect(documented).not.toMatch(/provider-deduplicated/i);
  });

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
