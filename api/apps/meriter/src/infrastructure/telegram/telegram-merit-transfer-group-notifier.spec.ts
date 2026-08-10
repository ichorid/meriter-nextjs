import { TelegramMeritTransferGroupNotifier } from './telegram-merit-transfer-group-notifier.service';
import { meritTransferGroupMessage } from './telegram-messages.ru';

describe('meritTransferGroupMessage', () => {
  it('formats transfer with optional comment', () => {
    expect(meritTransferGroupMessage('Иван', 'Мария', 10, 'спасибо')).toBe(
      'Иван перевёл 10 заслуг Мария.\nКомментарий: спасибо',
    );
    expect(meritTransferGroupMessage('Иван', 'Мария', 10)).toBe(
      'Иван перевёл 10 заслуг Мария.',
    );
  });
});

describe('TelegramMeritTransferGroupNotifier', () => {
  it('posts permanent message to linked telegram chat', async () => {
    const tgSendMessage = jest.fn().mockResolvedValue(42);
    const notifier = new TelegramMeritTransferGroupNotifier(
      { tgSendMessage } as never,
      {
        getDisplayNamesByUserIds: jest.fn().mockResolvedValue(
          new Map([
            ['s1', 'Иван'],
            ['r1', 'Мария'],
          ]),
        ),
      } as never,
      {
        getCommunity: jest.fn().mockResolvedValue({
          id: 'c1',
          telegramChatId: '-1001',
        }),
      } as never,
      {
        get: jest.fn().mockReturnValue({ productMode: 'telegram_mvp' }),
      } as never,
    );

    await notifier.announceTransfer({
      id: 'mt1',
      senderId: 's1',
      receiverId: 'r1',
      amount: 5,
      comment: 'за помощь',
      sourceWalletType: 'community',
      sourceContextId: 'c1',
      targetWalletType: 'community',
      targetContextId: 'c1',
      communityContextId: 'c1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(tgSendMessage).toHaveBeenCalledWith({
      chat_id: '-1001',
      text: 'Иван перевёл 5 заслуг Мария.\nКомментарий: за помощь',
    });
  });
});
