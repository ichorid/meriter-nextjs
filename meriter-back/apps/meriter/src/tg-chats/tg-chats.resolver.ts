import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { TgChatsService } from './tg-chats.service';
import { TgChat } from './model/tg-chat.model';
import { TgChatDto } from './model/tg-chat.dto';

@Resolver((of) => TgChat)
export class TgChatsResolver {
  constructor(private tgChatsService: TgChatsService) {}
  @Query(() => TgChatDto)
  async getTgChat(): Promise<TgChatDto> {
    return new TgChatDto();
  }

  @Mutation(() => TgChatDto, {
    name: 'tgChat',
    description: 'Used to upsert tg chat',
  })
  async upsertTgChat(): Promise<TgChatDto> {
    return new TgChatDto();
  }
}
