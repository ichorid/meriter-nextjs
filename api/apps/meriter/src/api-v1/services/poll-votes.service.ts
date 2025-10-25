import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollVote, PollVoteDocument } from '../models/poll-vote.model';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { CreatePollVoteDto } from '../types/domain.types';
import { uid } from 'uid';

@Injectable()
export class PollVotesService {
  private readonly logger = new Logger(PollVotesService.name);

  constructor(
    @InjectModel(PollVote.name) private pollVoteModel: Model<PollVoteDocument>,
  ) {}

  async createPollVote(createDto: CreatePollVoteDto, userId: string, communityId: string): Promise<PollVote> {
    // Check if user already voted on this poll
    const existingVote = await this.pollVoteModel.findOne({
      pollId: createDto.pollId,
      userId,
    }).exec();

    if (existingVote) {
      // Update existing vote
      existingVote.optionId = createDto.optionId;
      existingVote.amount = createDto.amount;
      existingVote.communityId = communityId;
      return existingVote.save();
    }

    // Create new vote
    const pollVote = new this.pollVoteModel({
      id: uid(),
      pollId: createDto.pollId,
      optionId: createDto.optionId,
      userId,
      amount: createDto.amount,
      communityId,
    });

    return pollVote.save();
  }

  async getPollVote(id: string): Promise<PollVote | null> {
    return this.pollVoteModel.findOne({ id }).exec();
  }

  async removePollVote(pollId: string, userId: string): Promise<boolean> {
    const result = await this.pollVoteModel.deleteOne({
      pollId,
      userId,
    }).exec();

    return result.deletedCount > 0;
  }

  async getPollVotes(pollId: string, pagination: any): Promise<PaginationResult<PollVote>> {
    const skip = PaginationHelper.getSkip(pagination);

    const votes = await this.pollVoteModel
      .find({ pollId })
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .exec();

    const total = await this.pollVoteModel.countDocuments({ pollId });

    return PaginationHelper.createResult(votes, total, pagination);
  }

  async getUserPollVotes(userId: string, pagination: any): Promise<PaginationResult<PollVote>> {
    const skip = PaginationHelper.getSkip(pagination);

    const votes = await this.pollVoteModel
      .find({ userId })
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .exec();

    const total = await this.pollVoteModel.countDocuments({ userId });

    return PaginationHelper.createResult(votes, total, pagination);
  }

  async getUserPollVotesForPoll(pollId: string, userId: string): Promise<PollVote[]> {
    return this.pollVoteModel.find({ pollId, userId }).exec();
  }

  async getPollVoteSummary(pollId: string): Promise<{
    totalVotes: number;
    totalAmount: number;
    voterCount: number;
    byOption: Record<string, { votes: number; voterCount: number }>;
  }> {
    const votes = await this.pollVoteModel.find({ pollId }).exec();

    const totalVotes = votes.reduce((sum, v) => sum + v.amount, 0);
    const totalAmount = votes.reduce((sum, v) => sum + v.amount, 0);
    const voterCount = votes.length;

    const byOption = votes.reduce((acc, vote) => {
      if (!acc[vote.optionId]) {
        acc[vote.optionId] = { votes: 0, voterCount: 0 };
      }
      acc[vote.optionId].votes += vote.amount;
      acc[vote.optionId].voterCount += 1;
      return acc;
    }, {} as Record<string, { votes: number; voterCount: number }>);

    return { totalVotes, totalAmount, voterCount, byOption };
  }

  async getUserVoteSummaryForPoll(pollId: string, userId: string): Promise<{
    voteCount: number;
    totalAmount: number;
    byOption: Record<string, number>;
  }> {
    const votes = await this.pollVoteModel.find({ pollId, userId }).exec();

    const voteCount = votes.length;
    const totalAmount = votes.reduce((sum, v) => sum + v.amount, 0);

    const byOption = votes.reduce((acc, vote) => {
      if (!acc[vote.optionId]) {
        acc[vote.optionId] = 0;
      }
      acc[vote.optionId] += vote.amount;
      return acc;
    }, {} as Record<string, number>);

    return { voteCount, totalAmount, byOption };
  }
}