import { Injectable, Logger, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Comment } from '../aggregates/comment/comment.entity';
import { CommentSchemaClass, CommentDocument } from '../models/comment/comment.schema';
import type { Comment as CommentSchema } from '../models/comment/comment.schema';
import { PublicationSchemaClass, PublicationDocument } from '../models/publication/publication.schema';
import type { Publication as PublicationSchema } from '../models/publication/publication.schema';
import { UserId } from '../value-objects';
import { CommentAddedEvent, CommentVotedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { CommentDocument as ICommentDocument } from '../../common/interfaces/comment-document.interface';
import { PublicationService } from './publication.service';
import { CommentSortingHelpers } from './comment-sorting.helpers';

export interface CreateCommentDto {
  targetType: 'publication' | 'comment';
  targetId: string;
  parentCommentId?: string;
  content: string;
  images?: string[]; // Array of image URLs
}

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    @InjectModel(CommentSchemaClass.name) private commentModel: Model<CommentDocument>,
    @InjectModel(PublicationSchemaClass.name) private publicationModel: Model<PublicationDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
    @Inject(forwardRef(() => PublicationService)) private publicationService: PublicationService,
  ) {}

  async createComment(userId: string, dto: CreateCommentDto): Promise<Comment> {
    this.logger.log(`Creating comment: user=${userId}, target=${dto.targetType}:${dto.targetId}`);

    const authorId = UserId.fromString(userId);

    // Validate target exists using Mongoose directly
    if (dto.targetType === 'publication') {
      const publication = await this.publicationModel.findOne({ id: dto.targetId }).lean();
      if (!publication) {
        throw new NotFoundException('Publication not found');
      }
    } else {
      // targetId should always be a real comment ID, not a vote-comment ID
      if (dto.targetId.startsWith('vote_')) {
        throw new NotFoundException(`Invalid targetId: cannot use vote-comment ID '${dto.targetId}' as targetId. Vote-comment IDs can only be used as parentCommentId.`);
      }
      const parentComment = await this.commentModel.findOne({ id: dto.targetId }).lean();
      if (!parentComment) {
        throw new NotFoundException(`Comment with id '${dto.targetId}' not found`);
      }
    }

    // Validate parent comment if replying to comment
    // Allow vote-comment IDs (starting with 'vote_') as parentCommentId
    if (dto.parentCommentId) {
      if (dto.parentCommentId.startsWith('vote_')) {
        // This is a vote-comment - validate that the vote exists
        // We'll allow it since vote-comments are valid parents
        // (they're synthetic but represent valid hierarchy)
      } else {
        // Regular comment parent - validate it exists
        const parent = await this.commentModel.findOne({ id: dto.parentCommentId }).lean();
        if (!parent) {
          throw new NotFoundException('Parent comment not found');
        }
      }
    }

    // Create comment aggregate
    const comment = Comment.create(
      authorId,
      dto.targetType,
      dto.targetId,
      dto.content,
      dto.parentCommentId,
      dto.images
    );

    // Save using Mongoose directly
    await this.commentModel.create(comment.toSnapshot());

    // If comment is on a publication, update the publication's commentCount
    if (dto.targetType === 'publication') {
      const publication = await this.publicationModel.findOne({ id: dto.targetId }).lean();
      if (publication) {
        // Update publication metrics to increment comment count
        const { Publication } = await import('../aggregates/publication/publication.entity');
        const pub = Publication.fromSnapshot(publication as any);
        pub.addComment();
        await this.publicationModel.updateOne(
          { id: dto.targetId },
          { $set: pub.toSnapshot() }
        );
      }
    }

    // Publish domain event
    await this.eventBus.publish(
      new CommentAddedEvent(comment.getId, dto.targetId, userId)
    );

    this.logger.log(`Comment created successfully: ${comment.getId}`);
    return comment;
  }

  async getComment(id: string): Promise<Comment | null> {
    const doc = await this.commentModel.findOne({ id }).lean();
    return doc ? Comment.fromSnapshot(doc as ICommentDocument) : null;
  }

  async getCommentsByTarget(
    targetType: 'publication' | 'comment',
    targetId: string,
    limit: number = 50,
    skip: number = 0,
    sortField: string = 'metrics.score',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<Comment[]> {
    const sort = CommentSortingHelpers.buildSortQuery(sortField, sortOrder);
    
    const docs = await this.commentModel
      .find({ targetType, targetId })
      .limit(limit)
      .skip(skip)
      .sort(sort as any)
      .lean();
    
    return docs.map(doc => Comment.fromSnapshot(doc as ICommentDocument));
  }

  async getCommentReplies(
    commentId: string,
    limit: number = 50,
    skip: number = 0,
    sortField: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<Comment[]> {
    const sort = CommentSortingHelpers.buildSortQuery(sortField, sortOrder);
    
    // Query for both:
    // 1. Comments that are direct replies (parentCommentId matches)
    // 2. Comments that are votes on this comment (targetType: 'comment' and targetId matches)
    const docs = await this.commentModel
      .find({
        $or: [
          { parentCommentId: commentId },
          { targetType: 'comment', targetId: commentId }
        ]
      })
      .limit(limit)
      .skip(skip)
      .sort(sort as any)
      .lean();
    
    return docs.map(doc => Comment.fromSnapshot(doc as ICommentDocument));
  }

  async getCommentsByAuthor(userId: string, limit: number = 50, skip: number = 0): Promise<Comment[]> {
    const docs = await this.commentModel
      .find({ authorId: userId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    
    return docs.map(doc => Comment.fromSnapshot(doc as ICommentDocument));
  }

  /**
   * Get the effective beneficiary for a comment
   * Comments cannot have beneficiaries, so always returns authorId
   */
  async getEffectiveBeneficiary(commentId: string): Promise<string | null> {
    const comment = await this.getComment(commentId);
    if (!comment) {
      return null;
    }
    return comment.getEffectiveBeneficiary().getValue();
  }

  /**
   * Check if user can withdraw from a comment
   * User must be the author (comments can't have beneficiaries)
   */
  async canUserWithdraw(commentId: string, userId: string): Promise<boolean> {
    const comment = await this.getComment(commentId);
    if (!comment) {
      return false;
    }
    return comment.getAuthorId.getValue() === userId;
  }

  async voteOnComment(commentId: string, userId: string, amount: number, direction: 'up' | 'down'): Promise<Comment> {
    // Load aggregate
    const doc = await this.commentModel.findOne({ id: commentId }).lean();
    if (!doc) {
      throw new NotFoundException('Comment not found');
    }

    const comment = Comment.fromSnapshot(doc as ICommentDocument);

    // Domain logic
    const voteAmount = direction === 'up' ? amount : -amount;
    comment.vote(voteAmount);

    // Save
    await this.commentModel.updateOne(
      { id: comment.getId },
      { $set: comment.toSnapshot() }
    );

    // Publish event
    await this.eventBus.publish(
      new CommentVotedEvent(commentId, userId, amount, direction)
    );

    return comment;
  }

  async reduceScore(commentId: string, amount: number): Promise<Comment> {
    // Load aggregate
    const doc = await this.commentModel.findOne({ id: commentId }).lean();
    if (!doc) {
      throw new NotFoundException('Comment not found');
    }

    const comment = Comment.fromSnapshot(doc as ICommentDocument);

    // Reduce score
    comment.reduceScore(amount);

    // Save
    await this.commentModel.updateOne(
      { id: comment.getId },
      { $set: comment.toSnapshot() }
    );

    return comment;
  }

  async updateComment(
    commentId: string,
    userId: string,
    updateData: { content: string },
  ): Promise<Comment> {
    const doc = await this.commentModel.findOne({ id: commentId }).lean();
    if (!doc) {
      throw new NotFoundException('Comment not found');
    }

    const comment = Comment.fromSnapshot(doc as ICommentDocument);

    // Authorization is handled by PermissionGuard via PermissionService.canEditComment()
    // PermissionService already checks vote count and time window for authors
    // Leads and superadmins can edit regardless of votes/time, so no additional check needed here

    // Update comment content by updating the document directly
    const snapshot = comment.toSnapshot();
    await this.commentModel.updateOne(
      { id: commentId },
      { 
        $set: { 
          content: updateData.content,
          updatedAt: new Date(),
        }
      }
    );

    // Return updated comment
    const updatedDoc = await this.commentModel.findOne({ id: commentId }).lean();
    if (!updatedDoc) {
      throw new NotFoundException('Comment not found after update');
    }
    return Comment.fromSnapshot(updatedDoc as ICommentDocument);
  }

  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    const comment = await this.getComment(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Authorization is handled by PermissionGuard via PermissionService.canDeleteComment()
    // No need for redundant check here

    await this.commentModel.deleteOne({ id: commentId });
    return true;
  }

  /**
   * Resolve comment to its community ID by traversing up to the publication.
   * Comments don't have direct communityId - need to trace to the publication.
   */
  async resolveCommentCommunityId(commentId: string): Promise<string> {
    const comment = await this.getComment(commentId);
    if (!comment) {
      throw new NotFoundException(`Comment not found: ${commentId}`);
    }

    // If comment is on a publication, get the publication's communityId
    if (comment.getTargetType === 'publication') {
      const publication = await this.publicationService.getPublication(comment.getTargetId);
      if (!publication) {
        throw new NotFoundException(`Publication not found: ${comment.getTargetId}`);
      }
      return publication.getCommunityId.getValue();
    }

    // Comment is on another comment - recursively find the publication
    let currentComment = comment;
    let depth = 0;
    const maxDepth = 20; // Prevent infinite loops

    while (currentComment.getTargetType === 'comment' && depth < maxDepth) {
      const parentComment = await this.getComment(currentComment.getTargetId);
      if (!parentComment) {
        throw new NotFoundException(`Parent comment not found: ${currentComment.getTargetId}`);
      }

      if (parentComment.getTargetType === 'publication') {
        const publication = await this.publicationService.getPublication(parentComment.getTargetId);
        if (!publication) {
          throw new NotFoundException(`Publication not found: ${parentComment.getTargetId}`);
        }
        return publication.getCommunityId.getValue();
      }

      currentComment = parentComment;
      depth++;
    }

    throw new NotFoundException(`Could not find root publication for comment (max depth reached): ${commentId}`);
  }
}
