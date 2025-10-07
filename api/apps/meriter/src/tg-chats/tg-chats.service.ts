import { Injectable } from '@nestjs/common';
import { ActorsService } from '@common/abstracts/actors/actors.service';

import { TgChat } from './model/tg-chat.model';
import { Document, Model } from 'mongoose';

@Injectable()
export class TgChatsService {
  constructor(private actorsService: ActorsService) {
    this.model = (this.actorsService.model as unknown) as Model<
      TgChat & Document
    >;
  }

  model: Model<TgChat & Document>;

  async upsert(
    tgBotUsername,
    tgChatId,
    name,
    description,
    avatarUrl,
    hashtags,
  ) {
    return this.actorsService.upsert<TgChat>(
      'tg-chat',
      { telegramId: tgChatId },
      {
        name,
        description,
        avatarUrl,
        meta: {
          hashtags,
          tgBotUsername,
        },
      },
    );
  }

  getInfo(telegramChatId) {
    return this.model.findOne({ identities: 'telegram://' + telegramChatId });
  }
}
