import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Community, CommunityDocument } from './community.schema';

@Injectable()
export class CommunityRepository {
  constructor(@InjectModel(Community.name) private readonly model: Model<CommunityDocument>) {}

  async findById(id: string): Promise<Community | null> {
    return this.model.findById(id).lean().exec();
  }

  async findByTelegramChatId(telegramChatId: string): Promise<Community | null> {
    return this.model.findOne({ telegramChatId }).lean().exec();
  }

  async create(communityData: Partial<Community>): Promise<Community> {
    const community = await this.model.create(communityData);
    return community.toObject();
  }

  async update(id: string, updateData: Partial<Community>): Promise<Community | null> {
    const community = await this.model.findByIdAndUpdate(id, updateData, { new: true }).lean().exec();
    return community;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: id }).exec();
    return result.deletedCount > 0;
  }

  async findMany(filter: any, limit: number = 50, skip: number = 0): Promise<Community[]> {
    return this.model.find(filter).limit(limit).skip(skip).lean().exec();
  }

  async findByAdministrator(userId: string): Promise<Community[]> {
    return this.model.find({ administrators: userId }).lean().exec();
  }

  async findByMember(userId: string): Promise<Community[]> {
    return this.model.find({ members: userId }).lean().exec();
  }

  async createCommunity(chatId: string, title: string, description?: string): Promise<Community> {
    const community = await this.model.create({
      telegramChatId: chatId,
      name: title,
      description,
      administrators: [],
      members: [],
      settings: {
        currencyNames: {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: 100,
      },
      hashtags: [],
      spaces: [],
      isAdmin: false,
      needsSetup: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return community.toObject();
  }

  async addMember(communityId: string, userId: string): Promise<void> {
    await this.model.updateOne(
      { _id: communityId },
      { $addToSet: { members: userId } }
    ).exec();
  }

  async removeMember(communityId: string, userId: string): Promise<void> {
    await this.model.updateOne(
      { _id: communityId },
      { $pull: { members: userId } }
    ).exec();
  }
}
