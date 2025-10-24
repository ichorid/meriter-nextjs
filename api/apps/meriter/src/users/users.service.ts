import { Injectable, Logger } from '@nestjs/common';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { AssetsService } from '@common/abstracts/assets/assets.service';
import { Document, FilterQuery, Model, UpdateQuery } from 'mongoose';

import { Actor } from '@common/abstracts/actors/schema/actor.schema';
import { TgBotsService } from '../tg-bots/tg-bots.service';

class User extends Actor {}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  
  constructor(public actorsService: ActorsService) {
    this.model = (this.actorsService.model as unknown) as Model<
      User & Document
    >;
    this.actorsService = actorsService;
  }
  model: Model<User & Document>;

  getByToken(token: string) {
    return this.model.findOne({ token });
  }
  async getProfileByTelegramId(telegramId: string) {
    const usr = await this.model.findOne({
      identities: 'telegram://' + telegramId,
    });
    return usr?.profile;
  }
  async upsert(
    condition: FilterQuery<User & Document>,
    data: UpdateQuery<User & Document>,
  ) {
    return this.actorsService.upsert('user', condition, data);
  }

  async pushTag(identity, value: string) {
    const user = await this.actorsService.model
      .findOne({ identities: identity })
      .lean();
    if (!user) throw `user not found for ${identity}`;

    //return true;

    return await this.actorsService.model.updateOne(
      {
        identities: identity,
      },
      { $addToSet: { tags: value } },
    );
  }

  async removeTag(chatId: string) {
    this.logger.log(`🧹 Removing chat ${chatId} from all user tags`);
    
    const result = await this.actorsService.model.updateMany(
      { tags: chatId },
      { $pull: { tags: chatId } }
    );
    
    this.logger.log(`✅ Removed chat ${chatId} from ${result.modifiedCount} user(s)`);
    return result;
  }
}
