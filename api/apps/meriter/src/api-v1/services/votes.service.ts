import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Vote, VoteDocument } from '../models/vote.model';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { CreateVoteDto } from '../types/domain.types';
import { uid } from 'uid';

@Injectable()
export class VotesService {
  private readonly logger = new Logger(VotesService.name);

  constructor(
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
  ) {}

  async createVote(createDto: CreateVoteDto, userId: string, communityId: string): Promise<Vote> {
    // Check if user already voted on this target
    const existingVote = await this.voteModel.findOne({
      targetType: createDto.targetType,
      targetId: createDto.targetId,
      userId,
    }).exec();

    if (existingVote) {
      // Update existing vote
      existingVote.amount = createDto.amount;
      existingVote.sourceType = createDto.sourceType;
      existingVote.communityId = communityId;
      return existingVote.save();
    }

    // Create new vote
    const vote = new this.voteModel({
      id: uid(),
      targetType: createDto.targetType,
      targetId: createDto.targetId,
      userId,
      amount: createDto.amount,
      sourceType: createDto.sourceType,
      communityId,
    });

    return vote.save();
  }

  async getVote(id: string): Promise<Vote | null> {
    return this.voteModel.findOne({ id }).exec();
  }

  async removeVote(targetType: string, targetId: string, userId: string): Promise<boolean> {
    const result = await this.voteModel.deleteOne({
      targetType,
      targetId,
      userId,
    }).exec();

    return result.deletedCount > 0;
  }

  async getVotes(
    targetType: string,
    targetId: string,
    pagination: any,
  ): Promise<PaginationResult<Vote>> {
    const skip = PaginationHelper.getSkip(pagination);

    const votes = await this.voteModel
      .find({ targetType, targetId })
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .exec();

    const total = await this.voteModel.countDocuments({ targetType, targetId });

    return PaginationHelper.createResult(votes, total, pagination);
  }

  async getUserVotes(userId: string, pagination: any): Promise<PaginationResult<Vote>> {
    const skip = PaginationHelper.getSkip(pagination);

    const votes = await this.voteModel
      .find({ userId })
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .exec();

    const total = await this.voteModel.countDocuments({ userId });

    return PaginationHelper.createResult(votes, total, pagination);
  }

  async getTargetVoteSummary(targetType: string, targetId: string): Promise<{
    upvotes: number;
    downvotes: number;
    score: number;
    voteCount: number;
  }> {
    const votes = await this.voteModel.find({ targetType, targetId }).exec();

    const upvotes = votes.filter(v => v.amount > 0).reduce((sum, v) => sum + v.amount, 0);
    const downvotes = votes.filter(v => v.amount < 0).reduce((sum, v) => sum + Math.abs(v.amount), 0);
    const score = upvotes - downvotes;
    const voteCount = votes.length;

    return { upvotes, downvotes, score, voteCount };
  }

  async getUserVoteOnTarget(targetType: string, targetId: string, userId: string): Promise<Vote | null> {
    return this.voteModel.findOne({
      targetType,
      targetId,
      userId,
    }).exec();
  }
}