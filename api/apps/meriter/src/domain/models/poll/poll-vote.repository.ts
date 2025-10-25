import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollVote, PollVoteDocument } from './poll-vote.schema';

@Injectable()
export class PollVoteRepository {
  constructor(@InjectModel(PollVote.name) private readonly model: Model<PollVoteDocument>) {}

  async findByPoll(pollId: string): Promise<PollVote[]> {
    return this.model.find({ pollId }).lean().exec();
  }

  async findByPollAndUser(pollId: string, userId: string): Promise<PollVote[]> {
    return this.model.find({ pollId, userId }).lean().exec();
  }

  async findByUser(userId: string, limit: number = 100, skip: number = 0): Promise<PollVote[]> {
    return this.model
      .find({ userId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async create(voteData: Partial<PollVote>): Promise<PollVote> {
    const vote = await this.model.create(voteData);
    return vote.toObject();
  }

  async aggregateByOption(pollId: string): Promise<Array<{ optionIndex: number; totalAmount: number; voteCount: number }>> {
    return this.model.aggregate([
      { $match: { pollId } },
      {
        $group: {
          _id: '$optionIndex',
          totalAmount: { $sum: '$amount' },
          voteCount: { $sum: 1 }
        }
      },
      {
        $project: {
          optionIndex: '$_id',
          totalAmount: 1,
          voteCount: 1
        }
      },
      { $sort: { optionIndex: 1 } }
    ]).exec();
  }
}
