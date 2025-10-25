import { Injectable, Logger } from '@nestjs/common';
import { TransactionsService } from '../../transactions/transactions.service';
import { PublicationsService } from '../../publications/publications.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Comment, CreateCommentDto } from '../types/domain.types';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly publicationsService: PublicationsService,
    private readonly tgBotsService: TgBotsService,
  ) {}

  async getComments(pagination: any, filters: any): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // Build query based on filters
    const query: any = {};
    
    if (filters.publicationId) {
      query['meta.parentPublicationUri'] = filters.publicationId;
    }
    
    if (filters.userId) {
      query['meta.from.telegramUserId'] = filters.userId;
    }

    const comments = await this.transactionsService.model
      .find(query)
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await this.transactionsService.model.countDocuments(query);

    const mappedComments = comments.map(comment => this.mapToComment(comment));

    return PaginationHelper.createResult(mappedComments, total, pagination);
  }

  async getComment(id: string, userId: string): Promise<Comment | null> {
    const comment = await this.transactionsService.model.findOne({
      uid: id,
    });

    if (!comment) {
      return null;
    }

    // Check if user has access to this comment's publication
    const publication = await this.publicationsService.model.findOne({
      uid: comment.meta?.parentPublicationUri,
    });

    if (publication) {
      const telegramCommunityChatId = publication.meta?.origin?.telegramChatId;
      if (telegramCommunityChatId) {
        const isMember = await this.tgBotsService.updateUserChatMembership(
          telegramCommunityChatId,
          userId,
        );
        if (!isMember) {
          return null;
        }
      }
    }

    return this.mapToComment(comment);
  }

  async createComment(createDto: CreateCommentDto, userId: string): Promise<Comment> {
    // Check if user has access to the publication
    const publication = await this.publicationsService.model.findOne({
      uid: createDto.publicationId,
    });

    if (!publication) {
      throw new Error('Publication not found');
    }

    const telegramCommunityChatId = publication.meta?.origin?.telegramChatId;
    if (telegramCommunityChatId) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        userId,
      );
      if (!isMember) {
        throw new Error('Not authorized to comment on this publication');
      }
    }

    // Create comment as a transaction
    const transaction = await this.transactionsService.createForPublication({
      amount: 0, // Comments don't have amounts
      comment: createDto.content,
      forPublicationUid: createDto.publicationId,
      fromUserTgId: userId,
      fromUserTgName: '', // Will be filled by service
    });

    return this.mapToComment(transaction);
  }

  async updateComment(id: string, updateDto: Partial<CreateCommentDto>): Promise<Comment> {
    const updateData: any = {};

    if (updateDto.content !== undefined) {
      updateData['meta.comment'] = updateDto.content;
    }

    const result = await this.transactionsService.model.updateOne(
      { uid: id },
      updateData,
    );

    if (result.modifiedCount === 0) {
      throw new Error('Comment not found');
    }

    const updatedComment = await this.transactionsService.model.findOne({ uid: id });
    return this.mapToComment(updatedComment);
  }

  async deleteComment(id: string): Promise<void> {
    const result = await this.transactionsService.model.deleteOne({ uid: id });

    if (result.deletedCount === 0) {
      throw new Error('Comment not found');
    }
  }

  async getPublicationComments(
    publicationId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);

    // Check if user has access to the publication
    const publication = await this.publicationsService.model.findOne({
      uid: publicationId,
    });

    if (!publication) {
      throw new Error('Publication not found');
    }

    const telegramCommunityChatId = publication.meta?.origin?.telegramChatId;
    if (telegramCommunityChatId) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        userId,
      );
      if (!isMember) {
        throw new Error('Not authorized to see this publication');
      }
    }

    const comments = await this.transactionsService.findForPublication(
      publicationId,
      true, // positive comments
    );

    const total = await this.transactionsService.model.countDocuments({
      'meta.parentPublicationUri': publicationId,
    });

    const mappedComments = comments.map(comment => this.mapToComment(comment));

    return PaginationHelper.createResult(mappedComments, total, pagination);
  }

  async getCommentReplies(
    commentId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);

    // Check if user has access to the parent comment's publication
    const parentComment = await this.transactionsService.model.findOne({
      uid: commentId,
    });

    if (!parentComment) {
      throw new Error('Parent comment not found');
    }

    const publication = await this.publicationsService.model.findOne({
      uid: parentComment.meta?.parentPublicationUri,
    });

    if (publication) {
      const telegramCommunityChatId = publication.meta?.origin?.telegramChatId;
      if (telegramCommunityChatId) {
        const isMember = await this.tgBotsService.updateUserChatMembership(
          telegramCommunityChatId,
          userId,
        );
        if (!isMember) {
          throw new Error('Not authorized to see this comment');
        }
      }
    }

    const replies = await this.transactionsService.findForTransaction(
      commentId,
      true, // positive replies
    );

    const total = await this.transactionsService.model.countDocuments({
      'meta.parentTransactionUri': commentId,
    });

    const mappedReplies = replies.map(reply => this.mapToComment(reply));

    return PaginationHelper.createResult(mappedReplies, total, pagination);
  }

  async getUserComments(userId: string, pagination: any): Promise<PaginationResult<Comment>> {
    const skip = PaginationHelper.getSkip(pagination);

    const comments = await this.transactionsService.findFromUserTgId(
      userId,
      true, // positive comments
    );

    const total = await this.transactionsService.model.countDocuments({
      'meta.from.telegramUserId': userId,
    });

    const mappedComments = comments.map(comment => this.mapToComment(comment));

    return PaginationHelper.createResult(mappedComments, total, pagination);
  }

  private mapToComment(transaction: any): Comment {
    return {
      id: transaction.uid,
      publicationId: transaction.meta?.parentPublicationUri || '',
      parentCommentId: transaction.meta?.parentTransactionUri,
      authorId: transaction.meta?.from?.telegramUserId || '',
      content: transaction.meta?.comment || '',
      metrics: {
        upvotes: transaction.meta?.metrics?.plus || 0,
        downvotes: transaction.meta?.metrics?.minus || 0,
        score: transaction.meta?.metrics?.sum || 0,
      },
      createdAt: transaction.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: transaction.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
