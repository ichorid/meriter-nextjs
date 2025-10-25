import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../repositories/base.repository';
import { Vote, VoteDocument } from './vote.schema';

@Injectable()
export class VoteRepository extends BaseRepository<Vote> {
  constructor(@InjectModel(Vote.name) model: Model<VoteDocument>) {
    super(model);
  }

  async findByTarget(targetType: string, targetId: string): Promise<Vote[]> {
    return this.find({ targetType, targetId });
  }

  async findByUser(userId: string, limit: number = 100, skip: number = 0): Promise<Vote[]> {
    return this.find(
      { userId },
      { limit, skip, sort: { createdAt: -1 } }
    );
  }

  async findByUserAndTarget(userId: string, targetType: string, targetId: string): Promise<Vote | null> {
    return this.findOne({ userId, targetType, targetId });
  }

  async deleteByUserAndTarget(userId: string, targetType: string, targetId: string): Promise<boolean> {
    const result = await this.model.deleteOne({ userId, targetType, targetId }).exec();
    return result.deletedCount > 0;
  }
}
