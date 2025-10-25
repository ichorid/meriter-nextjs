import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '../../repositories/base.repository';
import { PollVote, PollVoteDocument } from './poll-vote.schema';

@Injectable()
export class PollVoteRepository extends BaseRepository<PollVote> {
  constructor(@InjectModel(PollVote.name) model: Model<PollVoteDocument>) {
    super(model);
  }

  async findByPoll(pollId: string): Promise<PollVote[]> {
    return this.find({ pollId });
  }

  async findByPollAndUser(pollId: string, userId: string): Promise<PollVote[]> {
    return this.find({ pollId, userId });
  }

  async findByUser(userId: string, limit: number = 100, skip: number = 0): Promise<PollVote[]> {
    return this.find(
      { userId },
      { limit, skip, sort: { createdAt: -1 } }
    );
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
