import { TgChat, TgChatMeta } from './tg-chat.model';

export class TgChatDto implements Partial<TgChat> {
  telegramId: string;
  name: string;
  description: string;
  meta: TgChatMeta;
}
