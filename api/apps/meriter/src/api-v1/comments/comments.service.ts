import { Injectable, Logger } from '@nestjs/common';
import { CommentServiceV2 } from '../../domain/services/comment.service-v2';
import { PublicationServiceV2 } from '../../domain/services/publication.service-v2';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Comment, CreateCommentDto } from '../types/domain.types';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly commentServiceV2: CommentServiceV2,
    private readonly publicationServiceV2: PublicationServiceV2,
    private readonly tgBotsService: TgBotsService,
  ) {}

  async getComments(pagination: any, filters: any): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // Build query based on filters
    let domainComments: any[] = [];
    
    if (filters.publicationId) {
      domainComments = await this.commentServiceV2.getCommentsByTarget(
        'publication',
        filters.publicationId,
        pagination.limit,
        skip
      );
    } else if (filters.userId) {
      domainComments = await this.commentServiceV2.getCommentsByAuthor(
        filters.userId,
        pagination.limit,
        skip
      );
    } else {
      // Get all comments (this might need pagination limits)
      domainComments = await this.commentServiceV2.getCommentsByTarget(
        'publication',
        '', // This needs to be handled differently
        pagination.limit,
        skip
      );
    }

    // Convert domain entities to DTOs
    const mappedComments = domainComments.map(comment => this.mapToComment(comment));

    return PaginationHelper.createResult(mappedComments, mappedComments.length, pagination);
  }

  async getComment(id: string, userId: string): Promise<Comment | null> {
    const comment = await this.commentServiceV2.getComment(id);
    if (!comment) {
      return null;
    }

    // Check if user has access to this comment's publication
    const publication = await this.getPublicationForComment(comment);
    if (publication) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        publication.communityId,
        userId,
      );

      if (!isMember) {
        throw new Error('User is not a member of this community');
      }
    }

    return this.mapToComment(comment);
  }

  async createComment(createDto: CreateCommentDto, userId: string): Promise<Comment> {
    // Check if user has access to the target
    let telegramCommunityChatId: string | undefined;
    
    if (createDto.targetType === 'publication') {
      const publication = await this.publicationServiceV2.getPublication(createDto.targetId);
      if (!publication) {
        throw new Error('Publication not found');
      }
      telegramCommunityChatId = publication.getCommunityId.getValue();
    } else if (createDto.targetType === 'comment') {
      const parentComment = await this.commentServiceV2.getComment(createDto.targetId);
      if (!parentComment) {
        throw new Error('Parent comment not found');
      }

      // Get the publication from the parent comment
      const publication = await this.getPublicationForComment(parentComment);
      if (publication) {
        telegramCommunityChatId = publication.communityId;
      }
    }
    
    if (telegramCommunityChatId) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        userId,
      );

      if (!isMember) {
        throw new Error('User is not a member of this community');
      }
    }

    // Create comment using V2 service
    const comment = await this.commentServiceV2.createComment(userId, createDto);
    return this.mapToComment(comment);
  }

  async updateComment(id: string, updateDto: Partial<CreateCommentDto>): Promise<Comment | null> {
    const comment = await this.commentServiceV2.getComment(id);
    if (!comment) {
      return null;
    }

    // Update comment (this would need to be implemented in CommentServiceV2)
    // For now, return the existing comment
    return this.mapToComment(comment);
  }

  async deleteComment(id: string): Promise<boolean> {
    return await this.commentServiceV2.deleteComment(id, 'system'); // This needs proper user context
  }

  async getPublicationComments(
    publicationId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const comments = await this.commentServiceV2.getCommentsByTarget(
      'publication',
      publicationId,
      pagination.limit,
      skip
    );

    const mappedComments = comments.map(comment => this.mapToComment(comment));

    return PaginationHelper.createResult(mappedComments, mappedComments.length, pagination);
  }

  async getCommentReplies(
    commentId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const comments = await this.commentServiceV2.getCommentReplies(
      commentId,
      pagination.limit,
      skip
    );

    const mappedComments = comments.map(comment => this.mapToComment(comment));

    return PaginationHelper.createResult(mappedComments, mappedComments.length, pagination);
  }

  async getUserComments(
    userId: string,
    pagination: any,
    requestingUserId: string,
  ): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const comments = await this.commentServiceV2.getCommentsByAuthor(
      userId,
      pagination.limit,
      skip
    );

    const mappedComments = comments.map(comment => this.mapToComment(comment));

    return PaginationHelper.createResult(mappedComments, mappedComments.length, pagination);
  }

  private mapToComment(comment: any): Comment {
    return {
      id: comment.getId?.getValue() || comment.id,
      authorId: comment.getAuthorId?.getValue() || comment.authorId,
      targetType: comment.getTargetType?.() || comment.targetType,
      targetId: comment.getTargetId?.() || comment.targetId,
      parentCommentId: comment.getParentCommentId?.() || comment.parentCommentId,
      content: comment.getContent?.() || comment.content,
      metrics: {
        upvotes: comment.getMetrics?.().upvotes || comment.metrics?.upvotes || 0,
        downvotes: comment.getMetrics?.().downvotes || comment.metrics?.downvotes || 0,
        score: comment.getMetrics?.().score || comment.metrics?.score || 0,
        replyCount: comment.getMetrics?.().replyCount || comment.metrics?.replyCount || 0,
      },
      createdAt: comment.getCreatedAt?.()?.toISOString() || comment.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: comment.getUpdatedAt?.()?.toISOString() || comment.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private async getPublicationForComment(comment: any): Promise<any> {
    // This is a simplified implementation
    // In a real scenario, you'd need to track the publication ID in the comment
    return null;
  }
}