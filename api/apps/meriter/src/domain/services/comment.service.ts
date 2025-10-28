import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Comment } from '../aggregates/comment/comment.entity';
import { Comment as CommentSchema, CommentDocument } from '../models/comment/comment.schema';
import { Publication as PublicationSchema, PublicationDocument } from '../models/publication/publication.schema';
import { UserId } from '../value-objects';
import { CommentAddedEvent, CommentVotedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { CommentDocument as ICommentDocument } from '../../common/interfaces/comment-document.interface';

export interface CreateCommentDto {
  targetType: 'publication' | 'comment';
  targetId: string;
  parentCommentId?: string;
  content: string;
}

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    @InjectModel(CommentSchema.name) private commentModel: Model<CommentDocument>,
    @InjectModel(PublicationSchema.name) private publicationModel: Model<PublicationDocument>,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
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
      const parentComment = await this.commentModel.findOne({ id: dto.targetId }).lean();
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    // Validate parent comment if replying to comment
    if (dto.parentCommentId) {
      const parent = await this.commentModel.findOne({ id: dto.parentCommentId }).lean();
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    // Create comment aggregate
    const comment = Comment.create(
      authorId,
      dto.targetType,
      dto.targetId,
      dto.content,
      dto.parentCommentId
    );

    // Save using Mongoose directly
    await this.commentModel.create(comment.toSnapshot());

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
    skip: number = 0
  ): Promise<Comment[]> {
    const docs = await this.commentModel
      .find({ targetType, targetId })
      .limit(limit)
      .skip(skip)
      .sort({ 'metrics.score': -1 })
      .lean();
    
    return docs.map(doc => Comment.fromSnapshot(doc as ICommentDocument));
  }

  async getCommentReplies(commentId: string, limit: number = 50, skip: number = 0): Promise<Comment[]> {
    const docs = await this.commentModel
      .find({ parentCommentId: commentId })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: 1 })
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

  async deleteComment(commentId: string, userId: string): Promise<boolean> {
    const comment = await this.getComment(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const userIdObj = UserId.fromString(userId);
    if (!comment.canBeDeletedBy(userIdObj)) {
      throw new Error('Not authorized to delete this comment');
    }

    await this.commentModel.deleteOne({ id: commentId });
    return true;
  }
}
