import { Injectable, Logger, BadRequestException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Vote, VoteDocument } from '../models/vote/vote.schema';
import { VoteAmount, UserId } from '../value-objects';
import { uid } from 'uid';
import { PublicationService } from './publication.service';
import { CommentService } from './comment.service';

@Injectable()
export class VoteService {
  private readonly logger = new Logger(VoteService.name);

  constructor(
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectConnection() private mongoose: Connection,
    @Inject(forwardRef(() => PublicationService)) private publicationService: PublicationService,
    @Inject(forwardRef(() => CommentService)) private commentService: CommentService,
  ) {}

  /**
   * Check if user can vote on a publication or comment
   * Rules:
   * - Cannot vote if user is the effective beneficiary
   * - For publications: effective beneficiary = beneficiaryId if set, otherwise authorId
   * - For comments: effective beneficiary = authorId (comments can't have beneficiaries)
   */
  async canUserVote(userId: string, targetType: 'publication' | 'comment', targetId: string): Promise<boolean> {
    if (targetType === 'publication') {
      const publication = await this.publicationService.getPublication(targetId);
      if (!publication) {
        return false;
      }
      
      const effectiveBeneficiary = publication.getEffectiveBeneficiary();
      if (!effectiveBeneficiary) {
        return false;
      }
      
      // Cannot vote if user is the effective beneficiary
      return effectiveBeneficiary.getValue() !== userId;
    } else {
      // Comment
      const comment = await this.commentService.getComment(targetId);
      if (!comment) {
        return false;
      }
      
      // Comments can't have beneficiaries, so effective beneficiary is always author
      const authorId = comment.getAuthorId.getValue();
      
      // Cannot vote if user is the author
      return authorId !== userId;
    }
  }

  /**
   * Check if user can withdraw from a publication or comment
   * Rules:
   * - Can withdraw only if user is the effective beneficiary
   * - For publications: effective beneficiary = beneficiaryId if set, otherwise authorId
   * - For comments: effective beneficiary = authorId (comments can't have beneficiaries)
   */
  async canUserWithdraw(userId: string, targetType: 'publication' | 'comment', targetId: string): Promise<boolean> {
    if (targetType === 'publication') {
      const publication = await this.publicationService.getPublication(targetId);
      if (!publication) {
        return false;
      }
      
      const effectiveBeneficiary = publication.getEffectiveBeneficiary();
      if (!effectiveBeneficiary) {
        return false;
      }
      
      // Can withdraw only if user is the effective beneficiary
      return effectiveBeneficiary.getValue() === userId;
    } else {
      // Comment
      const comment = await this.commentService.getComment(targetId);
      if (!comment) {
        return false;
      }
      
      // Comments can't have beneficiaries, so effective beneficiary is always author
      const authorId = comment.getAuthorId.getValue();
      
      // Can withdraw only if user is the author
      return authorId === userId;
    }
  }

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

    // Validate that user can vote (mutual exclusivity check)
    const canVote = await this.canUserVote(userId, targetType, targetId);
    if (!canVote) {
      throw new BadRequestException('Cannot vote: you are the effective beneficiary of this content');
    }

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

}
