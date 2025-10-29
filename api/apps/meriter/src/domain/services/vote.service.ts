import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Vote, VoteDocument } from '../models/vote/vote.schema';
import { VoteAmount, UserId } from '../value-objects';
import { uid } from 'uid';

@Injectable()
export class VoteService {
  private readonly logger = new Logger(VoteService.name);

  constructor(
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectConnection() private mongoose: Connection,
  ) {}

  async createVote(
    userId: string,
    targetType: 'publication' | 'comment',
    targetId: string,
    amount: number,
    sourceType: 'personal' | 'quota',
    communityId?: string,
    attachedCommentId?: string
  ): Promise<Vote> {
    this.logger.log(`Creating vote: user=${userId}, target=${targetType}:${targetId}, amount=${amount}, sourceType=${sourceType}, communityId=${communityId}, attachedCommentId=${attachedCommentId}`);

    // Validate vote amount
    const voteAmount = amount > 0 ? VoteAmount.up(amount) : VoteAmount.down(Math.abs(amount));

    // Allow multiple votes on the same content - remove the duplicate check
    // Users can vote multiple times on the same publication/comment

    // Create vote
    const voteArray = await this.voteModel.create([{
      id: uid(),
      targetType,
      targetId,
      userId,
      amount: voteAmount.getNumericValue(),
      sourceType,
      communityId,
      attachedCommentId,
      createdAt: new Date(),
    }]);

    this.logger.log(`Vote created successfully: ${voteArray[0].id}`);
    return voteArray[0];
  }

  async removeVote(userId: string, targetType: 'publication' | 'comment', targetId: string): Promise<boolean> {
    this.logger.log(`Removing vote: user=${userId}, target=${targetType}:${targetId}`);

    const result = await this.voteModel.deleteOne(
      { userId, targetType, targetId }
    );
    
    if (result.deletedCount > 0) {
      this.logger.log(`Vote removed successfully`);
    }

    return result.deletedCount > 0;
  }

  async getUserVotes(userId: string, limit: number = 100, skip: number = 0): Promise<Vote[]> {
    return this.voteModel
      .find({ userId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async getTargetVotes(targetType: string, targetId: string): Promise<Vote[]> {
    return this.voteModel.find({ targetType, targetId }).lean().exec();
  }

  async getVotesByAttachedComment(commentId: string): Promise<Vote[]> {
    return this.voteModel.find({ attachedCommentId: commentId }).lean().exec();
  }

  async getVotesByAttachedComments(commentIds: string[]): Promise<Map<string, Vote[]>> {
    if (commentIds.length === 0) return new Map();
    
    const votes = await this.voteModel
      .find({ attachedCommentId: { $in: commentIds } })
      .lean()
      .exec();
    
    const votesMap = new Map<string, Vote[]>();
    votes.forEach(vote => {
      if (vote.attachedCommentId) {
        const existing = votesMap.get(vote.attachedCommentId) || [];
        existing.push(vote);
        votesMap.set(vote.attachedCommentId, existing);
      }
    });
    
    return votesMap;
  }

  async getVotesOnPublicationWithAttachedComments(publicationId: string): Promise<Vote[]> {
    return this.voteModel
      .find({ 
        targetType: 'publication', 
        targetId: publicationId,
        attachedCommentId: { $exists: true, $ne: null }
      })
      .lean()
      .exec();
  }

  async hasUserVoted(userId: string, targetType: string, targetId: string): Promise<boolean> {
    const vote = await this.voteModel.findOne({ userId, targetType, targetId }).lean();
    return vote !== null;
  }

  async hasVoted(userId: string, targetType: 'publication' | 'comment', targetId: string): Promise<boolean> {
    return this.hasUserVoted(userId, targetType, targetId);
  }

  async createVoteFromDto(userId: string, dto: { targetType: 'publication' | 'comment'; targetId: string; amount: number; communityId?: string }): Promise<Vote> {
    return this.createVote(userId, dto.targetType, dto.targetId, dto.amount, 'personal', dto.communityId);
  }
}
