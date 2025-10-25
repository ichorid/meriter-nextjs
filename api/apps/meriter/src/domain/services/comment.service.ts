import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { CommentRepository } from '../models/comment/comment.repository';
import { PublicationRepository } from '../models/publication/publication.repository';
import { UserRepository } from '../models/user/user.repository';
import { Comment } from '../models/comment/comment.schema';
import { PublicationContent, UserId } from '../value-objects';
import { CommentAddedEvent, CommentVotedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { v4 as uuidv4 } from 'uuid';

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
    private commentRepository: CommentRepository,
    private publicationRepository: PublicationRepository,
    private userRepository: UserRepository,
    private eventBus: EventBus,
  ) {}

  async createComment(userId: string, dto: CreateCommentDto): Promise<Comment> {
    this.logger.log(`Creating comment: user=${userId}, target=${dto.targetType}:${dto.targetId}`);

    // Validate content
    const content = PublicationContent.create(dto.content);
    const authorId = UserId.fromString(userId);

    // Validate target exists
    if (dto.targetType === 'publication') {
      const publication = await this.publicationRepository.findById(dto.targetId);
      if (!publication) {
        throw new NotFoundException('Publication not found');
      }
    } else {
      const parentComment = await this.commentRepository.findById(dto.targetId);
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    // Validate parent comment if replying to comment
    if (dto.parentCommentId) {
      const parent = await this.commentRepository.findById(dto.parentCommentId);
      if (!parent) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const comment = await this.commentRepository.create({
      id: uuidv4(),
      targetType: dto.targetType,
      targetId: dto.targetId,
      authorId: authorId.getValue(),
      content: content.getValue(),
      parentCommentId: dto.parentCommentId,
      metrics: {
        upthanks: 0,
        downthanks: 0,
        score: 0,
        replyCount: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Increment comment count if on publication
    if (dto.targetType === 'publication') {
      await this.publicationRepository.incrementCommentCount(dto.targetId);
    } else if (dto.targetType === 'comment') {
      await this.commentRepository.incrementReplyCount(dto.targetId);
    }

    // Publish domain event
    await this.eventBus.publish(
      new CommentAddedEvent(comment.id, dto.targetType === 'publication' ? dto.targetId : dto.targetId, userId)
    );

    this.logger.log(`Comment created successfully: ${comment.id}`);
    return comment;
  }

  async getComment(id: string): Promise<Comment | null> {
    return this.commentRepository.findById(id);
  }

  async getCommentsByTarget(targetType: string, targetId: string, limit: number = 50, skip: number = 0): Promise<Comment[]> {
    return this.commentRepository.findByTarget(targetType, targetId, limit, skip);
  }

  async getCommentsByAuthor(authorId: string, limit: number = 50, skip: number = 0): Promise<Comment[]> {
    return this.commentRepository.findByAuthor(authorId, limit, skip);
  }

  async getReplies(parentCommentId: string, limit: number = 20, skip: number = 0): Promise<Comment[]> {
    return this.commentRepository.findReplies(parentCommentId, limit, skip);
  }

  async voteOnComment(commentId: string, userId: string, amount: number, direction: 'up' | 'down'): Promise<Comment> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    // Update metrics
    const delta = direction === 'up' ? amount : -amount;
    const updated = await this.commentRepository.updateMetrics(commentId, delta);

    if (!updated) {
      throw new NotFoundException('Failed to update comment');
    }

    // Publish event
    await this.eventBus.publish(
      new CommentVotedEvent(commentId, userId, amount, direction)
    );

    return updated;
  }

  async deleteComment(id: string, userId: string): Promise<void> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new BadRequestException('Only the author can delete this comment');
    }

    await this.commentRepository.delete(id);
  }
}
