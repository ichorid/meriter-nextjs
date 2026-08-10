import * as TelegramTypes from '@common/extapis/telegram/telegram.types';
import { describeTelegramUpdateMeta } from './telegram-update-log.util';

describe('describeTelegramUpdateMeta', () => {
  it('classifies my_chat_member updates', () => {
    const body = {
      update_id: 42,
      my_chat_member: {
        chat: { id: -100123, type: 'supergroup' },
      },
    } as TelegramTypes.Update;

    expect(describeTelegramUpdateMeta(body)).toEqual({
      updateId: 42,
      kind: 'my_chat_member',
      chatId: '-100123',
    });
  });

  it('classifies message updates', () => {
    const body = {
      update_id: 7,
      message: {
        message_id: 1,
        chat: { id: -100999, type: 'supergroup' },
      },
    } as TelegramTypes.Update;

    expect(describeTelegramUpdateMeta(body)).toEqual({
      updateId: 7,
      kind: 'message',
      chatId: '-100999',
    });
  });

  it('returns unknown for empty update', () => {
    expect(describeTelegramUpdateMeta({ update_id: 1 } as TelegramTypes.Update)).toEqual({
      updateId: 1,
      kind: 'unknown',
    });
  });
});
