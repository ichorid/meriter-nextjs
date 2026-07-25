import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollCastSchemaClass, PollCastDocument } from '../../domain/models/poll/poll-cast.schema';
import type { PollCast } from '../../domain/models/poll/poll-cast.schema';

@Injectable()
/** Tier-3 migration: Mongoose-backed poll cast persistence (infrastructure). */
export class PollCastPersistenceAdapter {
  constructor(@InjectModel(PollCastSchemaClass.name) private readonly model: Model<PollCastDocument>) {}

  async findByPoll(pollId: string): Promise<PollCast[]> {
    return this.model.find({ pollId }).lean().exec();
  }

  async findByPollPaginated(query: {
    pollId: string;
    optionId?: string;
    skip: number;
    limit: number;
  }): Promise<{ items: PollCast[]; total: number }> {
    const filter: Record<string, unknown> = { pollId: query.pollId };
    if (query.optionId) {
      filter.optionId = query.optionId;
    }
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .lean()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  /** Per-user up/down totals across the whole poll, sorted by activity. */
  async aggregateCastersByPoll(
    pollId: string,
    limit: number,
  ): Promise<Array<{ userId: string; totalUp: number; totalDown: number }>> {
    return this.model
      .aggregate([
        { $match: { pollId } },
        {
          $project: {
            userId: 1,
            amount: { $add: ['$amountQuota', '$amountWallet'] },
            isDown: { $eq: ['$direction', 'down'] },
          },
        },
        {
          $group: {
            _id: '$userId',
            totalUp: { $sum: { $cond: ['$isDown', 0, '$amount'] } },
            totalDown: { $sum: { $cond: ['$isDown', '$amount', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            totalUp: 1,
            totalDown: 1,
            activity: { $add: ['$totalUp', '$totalDown'] },
          },
        },
        { $sort: { activity: -1 } },
        { $limit: limit },
        { $project: { userId: 1, totalUp: 1, totalDown: 1 } },
      ])
      .exec();
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

  async aggregateByOption(pollId: string): Promise<
    Array<{
      optionId: string;
      totalAmount: number;
      castCount: number;
      amountUp: number;
      amountDown: number;
      amount: number;
    }>
  > {
    return this.model.aggregate([
      { $match: { pollId } },
      {
        $project: {
          optionId: 1,
          castAmount: { $add: ['$amountQuota', '$amountWallet'] },
          isDown: { $eq: ['$direction', 'down'] }
        }
      },
      {
        $group: {
          _id: '$optionId',
          totalAmount: { $sum: '$castAmount' },
          castCount: { $sum: 1 },
          amountUp: { $sum: { $cond: ['$isDown', 0, '$castAmount'] } },
          amountDown: { $sum: { $cond: ['$isDown', '$castAmount', 0] } }
        }
      },
      {
        $project: {
          optionId: '$_id',
          totalAmount: 1,
          castCount: 1,
          amountUp: 1,
          amountDown: 1,
          amount: { $subtract: ['$amountUp', '$amountDown'] }
        }
      },
      { $sort: { optionId: 1 } }
    ]).exec();
  }

  async deleteByPoll(pollId: string): Promise<void> {
    await this.model.deleteMany({ pollId }).exec();
  }
}
