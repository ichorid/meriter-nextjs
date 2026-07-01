import type * as TelegramTypes from '@common/extapis/telegram/telegram.types';

export type TelegramUpdateMeta = {
  updateId: number | undefined;
  kind: string;
  chatId?: string;
};

/** Read-only classification for structured logs (no side effects). */
export function describeTelegramUpdateMeta(body: TelegramTypes.Update): TelegramUpdateMeta {
  const updateId = body.update_id;
  if (body.my_chat_member) {
    const chat = body.my_chat_member.chat as { id?: number } | undefined;
    return { updateId, kind: 'my_chat_member', chatId: chat?.id != null ? String(chat.id) : undefined };
  }
  if (body.chat_member) {
    const chat = body.chat_member.chat as { id?: number } | undefined;
    return { updateId, kind: 'chat_member', chatId: chat?.id != null ? String(chat.id) : undefined };
  }
  if (body.message_reaction) {
    const chat = body.message_reaction.chat;
    return {
      updateId,
      kind: 'message_reaction',
      chatId: chat?.id != null ? String(chat.id) : undefined,
    };
  }
  if (body.message_reaction_count) {
    const chat = body.message_reaction_count.chat as { id?: number } | undefined;
    return {
      updateId,
      kind: 'message_reaction_count',
      chatId: chat?.id != null ? String(chat.id) : undefined,
    };
  }
  if (body.callback_query) {
    const message = body.callback_query.message as { chat?: { id?: number } } | undefined;
    return {
      updateId,
      kind: 'callback_query',
      chatId: message?.chat?.id != null ? String(message.chat.id) : undefined,
    };
  }
  if (body.message) {
    const chat = body.message.chat as { id?: number } | undefined;
    return { updateId, kind: 'message', chatId: chat?.id != null ? String(chat.id) : undefined };
  }
  return { updateId, kind: 'unknown' };
}
