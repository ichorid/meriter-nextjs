import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UserRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<UserDocument>) {}

  async findById(id: string): Promise<User | null> {
    return this.model.findById(id).lean().exec();
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.model.findOne({ telegramId }).lean().exec();
  }

  async findByToken(token: string): Promise<User | null> {
    return this.model.findOne({ token }).lean().exec();
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = await this.model.create(userData);
    return user.toObject();
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    const user = await this.model.findByIdAndUpdate(id, updateData, { new: true }).lean().exec();
    return user;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  async findMany(filter: any, limit: number = 50, skip: number = 0): Promise<User[]> {
    return this.model.find(filter).limit(limit).skip(skip).lean().exec();
  }

  async createUser(telegramId: string, displayName: string, username?: string): Promise<User> {
    const user = await this.model.create({
      telegramId,
      displayName,
      username,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return user.toObject();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.model.findOne({ username }).lean().exec();
  }

  async findByCommunityTag(chatId: string): Promise<User[]> {
    return this.model.find({ tags: chatId }).lean().exec();
  }

  async removeCommunityTag(userId: string, chatId: string): Promise<void> {
    await this.model.updateOne(
      { _id: userId },
      { $pull: { tags: chatId } }
    ).exec();
  }

  async addCommunityTag(userId: string, chatId: string): Promise<void> {
    await this.model.updateOne(
      { _id: userId },
      { $addToSet: { tags: chatId } }
    ).exec();
  }
}
