import { Injectable } from '@nestjs/common';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { Actor } from '@common/abstracts/actors/schema/actor.schema';
import { mapConcatMeta } from '@common/lambdas/pure/objects';
import { Document, Model } from 'mongoose';
import { TgChat } from '../tg-chats/model/tg-chat.model';
import { Hashtag } from './model/hashtag.model';

@Injectable()
export class HashtagsService {
  constructor(public actorsService: ActorsService) {
    this.model = (this.actorsService.model as unknown) as Model<
      Hashtag & Document
    >;
  }

  model: Model<Hashtag & Document>;

  async upsertList(tgChatId: string, hashtags: Partial<Hashtag>[]) {
    await this.actorsService.model.deleteMany({
      'meta.parentTgChatId': tgChatId,
      uid: { $nin: hashtags.map((h) => h.uid) },
    });
    const promises = hashtags
      .map(mapConcatMeta({ parentTgChatId: tgChatId }))
      .map((hashtag) => {
        return hashtag.uid
          ? this.actorsService.upsert<Hashtag>(
              'hashtag',
              { uid: hashtag.uid },
              hashtag,
            )
          : this.actorsService.upsert<Hashtag>(
              'hashtag',
              { uid: 'not exist' },
              hashtag,
            );
      });
    return Promise.all(promises);
  }

  getInChat(telegramChatId) {
    return this.model.find({ 'meta.parentTgChatId': telegramChatId });
  }
}
