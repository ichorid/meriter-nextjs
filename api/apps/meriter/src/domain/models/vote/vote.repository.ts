import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vote, VoteDocument } from './vote.schema';

@Injectable()
export class VoteRepository {
  constructor(@InjectModel(Vote.name) private readonly model: Model<VoteDocument>) {}

  async findByTarget(targetType: string, targetId: string): Promise<Vote[]> {
    return this.model.find({ targetType, targetId }).lean().exec();
  }

  async findByUser(userId: string, limit: number = 100, skip: number = 0): Promise<Vote[]> {
    return this.model
      .find({ userId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findByUserAndTarget(userId: string, targetType: string, targetId: string): Promise<Vote | null> {
    return this.model.findOne({ userId, targetType, targetId }).lean().exec();
  }

  async create(voteData: Partial<Vote>): Promise<Vote> {
    const vote = await this.model.create(voteData);
    return vote.toObject();
  }

  async deleteByUserAndTarget(userId: string, targetType: string, targetId: string): Promise<boolean> {
    const result = await this.model.deleteOne({ userId, targetType, targetId }).exec();
    return result.deletedCount > 0;
  }
}
