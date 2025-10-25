import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

// Legacy user schema interface (for existing database)
interface LegacyUser {
  uid: string;
  token: string;
  identities: string[];
  tags?: string[];
  profile?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    bio?: string;
    location?: string;
    website?: string;
    isVerified?: boolean;
  };
  meta?: {
    username?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
  toObject?: () => any;
}

@Injectable()
export class UsersService {
  public readonly model: Model<LegacyUser>;

  constructor(@InjectConnection() private connection: Connection) {
    // Access the legacy 'actors' collection directly
    this.model = this.connection.model<LegacyUser>('Actor', undefined, 'actors');
  }

  async getByToken(token: string): Promise<LegacyUser | null> {
    return this.model.findOne({ token }).exec();
  }

  async findByIdentity(identity: string): Promise<LegacyUser | null> {
    return this.model.findOne({ identities: identity }).exec();
  }

  async upsert(filter: any, update: any): Promise<LegacyUser | null> {
    return this.model.findOneAndUpdate(
      filter,
      { $set: update },
      { upsert: true, new: true }
    ).exec();
  }

  async removeTag(chatId: string): Promise<{ modifiedCount: number }> {
    const result = await this.model.updateMany(
      { tags: chatId },
      { $pull: { tags: chatId } }
    ).exec();
    return { modifiedCount: result.modifiedCount };
  }

  async pushTag(userIdentity: string, tag: string): Promise<void> {
    await this.model.updateOne(
      { identities: userIdentity },
      { $addToSet: { tags: tag } }
    ).exec();
  }
}

