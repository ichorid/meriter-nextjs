import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

// Legacy TgChat schema interface (for existing database)
interface LegacyTgChat {
  uid: string;
  domainName: string;
  identities: string[];
  administrators?: string[];
  tags?: string[];
  profile?: {
    name?: string;
    description?: string;
    avatarUrl?: string;
  };
  meta?: {
    hashtagLabels?: string[];
    iconUrl?: string;
    currencyNames?: {
      singular: string;
      plural: string;
      genitive: string;
    };
    dailyEmission?: number;
  };
  createdAt?: Date;
  updatedAt?: Date;
  toObject?: () => any;
}

@Injectable()
export class TgChatsService {
  public readonly model: Model<LegacyTgChat>;

  constructor(@InjectConnection() private connection: Connection) {
    // Access the legacy 'actors' collection (tg-chats are also stored there with domainName: 'tg-chat')
    this.model = this.connection.model<LegacyTgChat>('Actor', undefined, 'actors');
  }

  async findById(id: string): Promise<LegacyTgChat | null> {
    return this.model.findOne({ uid: id }).exec();
  }

  async findByIdentity(identity: string): Promise<LegacyTgChat | null> {
    return this.model.findOne({ identities: identity }).exec();
  }

  async findAll(): Promise<LegacyTgChat[]> {
    return this.model.find({ domainName: 'tg-chat' }).exec();
  }

  async upsert(filter: any, update: any): Promise<LegacyTgChat | null> {
    return this.model.findOneAndUpdate(
      filter,
      { $set: update },
      { upsert: true, new: true }
    ).exec();
  }

  async updateUserChatMembership(chatId: string, userId: string): Promise<boolean> {
    // This is a placeholder. In a real scenario, this would involve:
    // 1. Calling Telegram Bot API to check if the user is a member of the chat.
    // 2. Updating the user's tags/memberships in the database based on the result.
    // For now, we'll assume the user is a member and add the tag.
    // The actual logic for adding/removing tags is in UsersService.
    return true;
  }
}

