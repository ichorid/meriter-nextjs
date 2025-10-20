import { Injectable } from '@nestjs/common';
import { AssetsService } from '@common/abstracts/assets/assets.service';

import { Publication } from './model/publication.model';

import { Document, Model } from 'mongoose';
import { UsersService } from '../users/users.service';

@Injectable()
export class PublicationsService {
  constructor(private assetService: AssetsService) {
    this.model = (this.assetService.model as unknown) as Model<
      Publication & Document
    >;
  }
  model: Model<Publication & Document>;

  getPublicationsInTgChat(telegramChatId: string, limit: number, skip: number) {
    return this.model.find(
      { 'meta.origin.telegramChatId': telegramChatId },
      {},
      { skip, limit, sort: { createdAt: -1 } },
    );
  }

  getPublicationsInHashtagSlug(
    hashtagSlug: string,
    limit: number,
    skip: number,
  ) {
    return this.model.find(
      { 'meta.hashtagSlug': hashtagSlug },
      {},
      { skip, limit, sort: { 'meta.metrics.sum': -1 } },
    );
  }

  getPublicationsOfAuthorTgId(
    tgAuthorId: string,
    limit: number,
    skip: number,
    positive,
  ) {
    return this.model.find(
      {
        'meta.author.telegramId': tgAuthorId,
        'meta.metrics.sum': positive ? { $gte: 0 } : { $ne: false },
      },
      undefined,
      { skip, limit, sort: { 'meta.metrics.sum': -1 } },
    );
  }

  async deltaByUid(uid: string, amount: number) {
    return amount > 0
      ? this.model.updateOne(
          { uid },
          {
            $inc: { 'meta.metrics.plus': amount, 'meta.metrics.sum': amount },
          },
        )
      : this.model.updateOne(
          { uid },
          {
            $inc: { 'meta.metrics.minus': -amount, 'meta.metrics.sum': amount },
          },
        );
  }
}
