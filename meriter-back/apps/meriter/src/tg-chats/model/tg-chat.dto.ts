import { TgChat, TgChatMeta } from './tg-chat.model';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TgChatDto implements Partial<TgChat> {
  telegramId: string;
  name: string;
  description: string;
  // @Field((type) => TgChatMeta)
  meta: TgChatMeta;
}
