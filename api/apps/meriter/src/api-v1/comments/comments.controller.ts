import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { CommentService } from '../../domain/services/comment.service';
import { UserService } from '../../domain/services/user.service';
import { VoteService } from '../../domain/services/vote.service';
import { PublicationService } from '../../domain/services/publication.service';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { PermissionService } from '../../domain/services/permission.service';
import { UserEnrichmentService } from '../common/services/user-enrichment.service';
import { EntityMappers } from '../common/mappers/entity-mappers';
import { UserFormatter } from '../common/utils/user-formatter.util';
import { VoteCommentResolverService } from '../common/services/vote-comment-resolver.service';
import { CommentEnrichmentService } from '../common/services/comment-enrichment.service';
import { VoteTransactionCalculatorService } from '../common/services/vote-transaction-calculator.service';
import { UserGuard } from '../../user.guard';
import { PermissionGuard } from '../../permission.guard';
import { RequirePermission } from '../../common/decorators/permission.decorator';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { ApiResponseHelper } from '../common/helpers/api-response.helper';
import {
  NotFoundError,
  ForbiddenError,
} from '../../common/exceptions/api.exceptions';
import {
  Comment,
  CreateCommentDto,
  CreateCommentDtoSchema,
  UpdateCommentDtoSchema,
} from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';

@Controller('api/v1/comments')
@UseGuards(UserGuard, PermissionGuard)
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);

  constructor(
    private readonly commentsService: CommentService,
    private readonly userService: UserService,
    private readonly voteService: VoteService,
    private readonly publicationService: PublicationService,
    private readonly communityService: CommunityService,
    private readonly walletService: WalletService,
    private readonly userEnrichmentService: UserEnrichmentService,
    private readonly voteCommentResolver: VoteCommentResolverService,
    private readonly commentEnrichment: CommentEnrichmentService,
    private readonly permissionService: PermissionService,
  ) {}

  @Get()
  async getComments(@Query() query: any) {
    // For now, return empty array - this endpoint needs to be implemented based on business requirements
    return { data: [], total: 0, skip: 0, limit: 50 };
  }

  @Get(':id/details')
  async getCommentDetails(@Param('id') id: string, @Req() req: any) {
    const { vote, snapshot, authorId } =
      await this.voteCommentResolver.resolve(id);

    // Fetch author data
    const author = await this.commentEnrichment.fetchAuthor(authorId);

    // Fetch beneficiary and community
    const { beneficiary, community } =
      await this.commentEnrichment.fetchBeneficiaryAndCommunity(vote, authorId);

    // Calculate vote transaction data
    const voteTransactionData =
      VoteTransactionCalculatorService.calculate(vote);

    // Fetch votes on the vote/comment itself (for metrics)
    let commentVotes = [];
    try {
      if (vote) {
        // If this is a vote, get votes on this vote
        commentVotes = await this.voteService.getVotesOnVote(id);
      } else {
        // For regular comments (legacy), try to get votes (though this might not work anymore)
        commentVotes = await this.voteService.getTargetVotes('comment', id);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch votes on comment ${id}:`,
        error.message,
      );
    }

    // Calculate comment metrics from votes using stored direction field
    const upvotes = commentVotes.filter((v) => v.direction === 'up').length;
    const downvotes = commentVotes.filter((v) => v.direction === 'down').length;
    // Score: sum of upvote amounts minus sum of downvote amounts
    const score = commentVotes.reduce((sum, v) => {
      const quota = v.amountQuota || 0;
      const wallet = v.amountWallet || 0;
      const total = quota + wallet;
      // Use stored direction field to determine if vote is upvote or downvote
      return sum + (v.direction === 'up' ? total : -total);
    }, 0);

    // Aggregated totals (avoid loading extra docs unnecessarily)
    let totalReceived = 0;
    let totalWithdrawn = 0;
    try {
      if (vote) {
        totalReceived = await this.voteService.getPositiveSumForVote(id);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to aggregate positive votes for ${id}:`,
        err?.message || err,
      );
    }
    try {
      // Sum of all withdrawals referencing this vote/comment
      const withdrawalType = vote ? 'vote_withdrawal' : 'comment_withdrawal';
      totalWithdrawn = (await (this as any).walletService
        ?.getTotalWithdrawnByReference)
        ? await (this as any).walletService.getTotalWithdrawnByReference(
            withdrawalType,
            id,
          )
        : 0;
    } catch (err) {
      this.logger.warn(
        `Failed to aggregate withdrawals for ${id}:`,
        err?.message || err,
      );
    }

    const response = {
      comment: {
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      },
      author: UserFormatter.formatUserForApi(author, authorId),
      voteTransaction: voteTransactionData,
      beneficiary: beneficiary,
      community: community,
      metrics: {
        upvotes,
        downvotes,
        score,
        totalReceived,
      },
      withdrawals: {
        totalWithdrawn,
      },
    };

    return ApiResponseHelper.successResponse(response);
  }

  @Get(':id')
  async getComment(@Param('id') id: string, @Req() req: any) {
    const { vote, snapshot, authorId } =
      await this.voteCommentResolver.resolve(id);

    // Fetch author data
    const author = await this.commentEnrichment.fetchAuthor(authorId);

    // Calculate vote transaction data
    const voteTransactionData =
      VoteTransactionCalculatorService.calculate(vote);

    const commentData = {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      meta: {
        author: UserFormatter.formatUserForApi(author, authorId),
      },
      // Add vote transaction fields if comment is associated with a vote
      ...voteTransactionData,
    };

    return ApiResponseHelper.successResponse(commentData);
  }

  @Post()
  @ZodValidation(CreateCommentDtoSchema)
  async createComment(
    @Body() createDto: CreateCommentDto,
    @Req() req: any,
  ): Promise<Comment> {
    // Check permissions using PermissionService
    // For comments, we need to resolve the publication ID first
    let publicationId: string;
    if (createDto.targetType === 'publication') {
      publicationId = createDto.targetId;
    } else {
      // Comment on comment - need to resolve to publication
      // We'll use the resolveCommentCommunityId method which traverses up to find the publication
      // But we need publication ID, not community ID
      // For now, we'll get the comment and traverse manually
      const parentComment = await this.commentsService.getComment(
        createDto.targetId,
      );
      if (!parentComment) {
        throw new NotFoundError('Parent comment', createDto.targetId);
      }

      // Traverse up to find publication
      let currentComment = parentComment;
      let depth = 0;
      const maxDepth = 20;

      while (currentComment.getTargetType === 'comment' && depth < maxDepth) {
        const nextComment = await this.commentsService.getComment(
          currentComment.getTargetId,
        );
        if (!nextComment) {
          throw new NotFoundError(
            'Comment in chain',
            currentComment.getTargetId,
          );
        }
        if (nextComment.getTargetType === 'publication') {
          publicationId = nextComment.getTargetId;
          break;
        }
        currentComment = nextComment;
        depth++;
      }

      if (!publicationId && currentComment.getTargetType === 'publication') {
        publicationId = currentComment.getTargetId;
      }

      if (!publicationId) {
        throw new NotFoundError('Publication for comment', createDto.targetId);
      }
    }

    const canComment = await this.permissionService.canComment(
      req.user.id,
      publicationId,
    );
    if (!canComment) {
      throw new ForbiddenError(
        'You do not have permission to comment on this publication',
      );
    }

    const comment = await this.commentsService.createComment(
      req.user.id,
      createDto,
    );

    // Fetch author data (should be current user)
    const authorId = comment.getAuthorId.getValue();
    const author = await this.commentEnrichment.fetchAuthor(authorId);

    const snapshot = comment.toSnapshot();
    const response = {
      ...snapshot,
      metrics: {
        ...snapshot.metrics,
        score: snapshot.metrics.score ?? comment.getMetrics.score,
      },
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      meta: {
        author: UserFormatter.formatUserForApi(author, authorId),
      },
    };
    return ApiResponseHelper.successResponse(response);
  }

  @Put(':id')
  @ZodValidation(UpdateCommentDtoSchema)
  @RequirePermission('edit', 'comment')
  async updateComment(
    @Param('id') id: string,
    @Body() updateDto: any,
    @Req() req: any,
  ): Promise<Comment> {
    if (!updateDto.content) {
      throw new NotFoundError('Comment', 'Content is required');
    }
    const updatedComment = await this.commentsService.updateComment(
      id,
      req.user.id,
      { content: updateDto.content }
    );

    // Extract author ID for enrichment
    const authorId = updatedComment.getAuthorId.getValue();

    // Batch fetch users for enrichment
    const usersMap = await this.userEnrichmentService.batchFetchUsers([authorId]);

    // Map domain entity to API format
    const mappedComment = EntityMappers.mapCommentToApi(
      updatedComment,
      usersMap,
    );

    return ApiResponseHelper.successResponse(mappedComment);
  }

  @Delete(':id')
  @RequirePermission('delete', 'comment')
  async deleteComment(@Param('id') id: string, @Req() req: any) {
    await this.commentsService.deleteComment(id, req.user.id);
    return ApiResponseHelper.successMessage('Comment deleted successfully');
  }

  @Get('publications/:publicationId')
  async getPublicationComments(
    @Param('publicationId') publicationId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const sortField = query.sort || 'createdAt';
    const sortOrder = (query.order || 'desc') === 'asc' ? 'asc' : 'desc';

    // Get votes on this publication (votes now contain comments)
    const votes = await this.voteService.getPublicationVotes(
      publicationId,
      pagination.limit,
      skip,
      sortField,
      sortOrder,
    );

    // Extract unique user IDs (vote authors)
    const userIdsArray = Array.from(
      new Set(votes.map((v) => v.userId).filter(Boolean)),
    );

    // Batch fetch all users using enrichment service
    const usersMap =
      await this.userEnrichmentService.batchFetchUsers(userIdsArray);

    // Get publication to get slug and communityId
    const publication =
      await this.publicationService.getPublication(publicationId);
    const publicationSlug = publication?.getId.getValue();
    const communityId = publication?.getCommunityId.getValue();

    // Batch fetch votes on votes (for nested replies)
    const voteIds = votes.map((v) => v.id);
    const votesOnVotesMap = await this.voteService.getVotesOnVotes(voteIds);

    // Convert votes to comment-like objects using EntityMappers
    const enrichedComments = votes.map((vote) => {
      const baseComment = EntityMappers.mapCommentToApi(
        vote,
        usersMap,
        publicationSlug,
        communityId,
      );

      // Get votes on this vote (replies)
      const replies = votesOnVotesMap.get(vote.id) || [];
      const replyCount = replies.length;

      // Calculate score from replies (sum of reply vote amounts)
      const score = replies.reduce((sum, r) => {
        const quota = r.amountQuota || 0;
        const wallet = r.amountWallet || 0;
        const total = quota + wallet;
        return sum + (quota > 0 ? total : -total);
      }, 0);
      const upvotes = replies.filter((r) => (r.amountQuota || 0) > 0).length;
      const downvotes = replies.filter(
        (r) => (r.amountQuota || 0) === 0 && (r.amountWallet || 0) > 0,
      ).length;

      return {
        ...baseComment,
        // Metrics from votes on this vote (replies)
        metrics: {
          upvotes,
          downvotes,
          score,
          replyCount,
        },
      };
    });

    // Get total count for pagination
    const totalVotes =
      await this.voteService.getVotesOnPublication(publicationId);
    const total = totalVotes.length;

    return { data: enrichedComments, total, skip, limit: pagination.limit };
  }

  @Get(':id/replies')
  async getCommentReplies(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const sortField = query.sort || 'createdAt';
    const sortOrder = (query.order || 'desc') === 'asc' ? 'asc' : 'desc';

    // Get votes on this vote (id is a vote ID)
    const votes = await this.voteService.getVotesOnVote(id);

    // Sort votes
    votes.sort((a, b) => {
      if (sortField === 'createdAt') {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortField === 'score') {
        // Calculate score as sum of quota and wallet amounts
        // Calculate score using stored direction field
        const amountA = (a.amountQuota || 0) + (a.amountWallet || 0);
        const amountB = (b.amountQuota || 0) + (b.amountWallet || 0);
        const scoreA = a.direction === 'up' ? amountA : -amountA;
        const scoreB = b.direction === 'up' ? amountB : -amountB;
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
      return 0;
    });

    // Apply pagination
    const paginatedVotes = votes.slice(skip, skip + pagination.limit);

    // Extract unique user IDs (vote authors)
    const userIdsArray = Array.from(
      new Set(paginatedVotes.map((v) => v.userId).filter(Boolean)),
    );

    // Batch fetch all users using enrichment service
    const usersMap =
      await this.userEnrichmentService.batchFetchUsers(userIdsArray);

    // Batch fetch votes on votes (for nested replies)
    const voteIds = paginatedVotes.map((v) => v.id);
    const votesOnVotesMap = await this.voteService.getVotesOnVotes(voteIds);

    // Convert votes to comment-like objects using EntityMappers
    const enrichedReplies = paginatedVotes.map((vote) => {
      const baseComment = EntityMappers.mapCommentToApi(vote, usersMap);

      // Get votes on this vote (replies)
      const replies = votesOnVotesMap.get(vote.id) || [];
      const replyCount = replies.length;

      // Calculate score from replies (sum of reply vote amounts)
      const score = replies.reduce((sum, r) => {
        const quota = r.amountQuota || 0;
        const wallet = r.amountWallet || 0;
        const total = quota + wallet;
        // Use stored direction field to determine if vote is upvote or downvote
        return sum + (r.direction === 'up' ? total : -total);
      }, 0);
      const upvotes = replies.filter((r) => r.direction === 'up').length;
      const downvotes = replies.filter((r) => r.direction === 'down').length;

      return {
        ...baseComment,
        targetType: 'vote',
        targetId: id, // The parent vote ID
        // Metrics from votes on this vote (replies)
        metrics: {
          upvotes,
          downvotes,
          score,
          replyCount,
        },
      };
    });

    return {
      data: enrichedReplies,
      total: votes.length,
      skip,
      limit: pagination.limit,
    };
  }

  @Get('users/:userId')
  async getUserComments(
    @Param('userId') userId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const comments = await this.commentsService.getCommentsByAuthor(
      userId,
      pagination.limit,
      skip,
    );

    // Extract unique author IDs
    const authorIds = new Set<string>();
    comments.forEach((comment) => {
      const authorId = comment.getAuthorId.getValue();
      if (authorId) {
        authorIds.add(authorId);
      }
    });

    // Batch fetch all authors
    const usersMap = new Map<string, any>();
    await Promise.all(
      Array.from(authorIds).map(async (userId) => {
        try {
          const user = await this.userService.getUser(userId);
          if (user) {
            usersMap.set(userId, user);
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch author ${userId}:`, error.message);
        }
      }),
    );

    // Extract unique publication IDs for comments targeting publications
    const publicationIds = new Set<string>();
    comments.forEach((comment) => {
      if (comment.getTargetType === 'publication') {
        publicationIds.add(comment.getTargetId);
      }
    });

    // Batch fetch all publications to get slugs and community IDs
    const publicationsMap = new Map<string, any>();
    await Promise.all(
      Array.from(publicationIds).map(async (publicationId) => {
        try {
          const publication =
            await this.publicationService.getPublication(publicationId);
          if (publication) {
            publicationsMap.set(publicationId, {
              id: publication.getId.getValue(),
              slug: publication.getId.getValue(), // Use ID as slug
              communityId: publication.getCommunityId.getValue(),
            });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to fetch publication ${publicationId}:`,
            error.message,
          );
        }
      }),
    );

    // Enrich comments with author metadata and publication data using EntityMappers
    const enrichedComments = comments.map((comment) => {
      const snapshot = comment.toSnapshot();
      const authorId = comment.getAuthorId.getValue();

      // Get publication data if comment targets a publication
      let publicationSlug: string | undefined;
      let communityId: string | undefined;
      if (comment.getTargetType === 'publication') {
        const publicationId = comment.getTargetId;
        const publication = publicationsMap.get(publicationId);
        if (publication) {
          publicationSlug = publication.slug;
          communityId = publication.communityId;
        }
      }

      return EntityMappers.mapCommentToApi(
        comment,
        usersMap,
        publicationSlug,
        communityId,
      );
    });

    return {
      data: enrichedComments,
      total: enrichedComments.length,
      skip,
      limit: pagination.limit,
    };
  }
}
