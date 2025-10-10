import { IsString, IsObject } from 'class-validator';
import { TgChat, TgChatMeta } from './tg-chat.model';

export class TgChatDto implements Partial<TgChat> {
  @IsString()
  telegramId: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsObject()
  meta: TgChatMeta;
}
