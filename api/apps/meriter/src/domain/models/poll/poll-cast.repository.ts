import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollCastSchemaClass, PollCastDocument } from './poll-cast.schema';
import type { PollCast } from './poll-cast.schema';

@Injectable()
export class PollCastRepository {
  constructor(@InjectModel(PollCastSchemaClass.name) private readonly model: Model<PollCastDocument>) {}

  async findByPoll(pollId: string): Promise<PollCast[]> {
    return this.model.find({ pollId }).lean().exec();
  }

  async findByPollAndUser(pollId: string, userId: string): Promise<PollCast[]> {
    return this.model.find({ pollId, userId }).lean().exec();
  }

  async findByUser(userId: string, limit: number = 100, skip: number = 0): Promise<PollCast[]> {
    return this.model
      .find({ userId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async create(castData: Partial<PollCast>): Promise<PollCast> {
    const cast = await this.model.create(castData);
    return cast.toObject();
  }

  async aggregateByOption(pollId: string): Promise<Array<{ optionId: string; totalAmount: number; castCount: number }>> {
    return this.model.aggregate([
      { $match: { pollId } },
      {
        $project: {
          optionId: 1,
          totalAmount: { $add: ['$amountQuota', '$amountWallet'] }
        }
      },
      {
        $group: {
          _id: '$optionId',
          totalAmount: { $sum: '$totalAmount' },
          castCount: { $sum: 1 }
        }
      },
      {
        $project: {
          optionId: '$_id',
          totalAmount: 1,
          castCount: 1
        }
      },
      { $sort: { optionId: 1 } }
    ]).exec();
  }
}
