import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { CreateCommentDtoSchema, UpdateCommentDtoSchema } from '@meriter/shared-types';
import { EntityMappers } from '../../api-v1/common/mappers/entity-mappers';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { VoteTransactionCalculatorService } from '../../api-v1/common/services/vote-transaction-calculator.service';
import { UserFormatter } from '../../api-v1/common/utils/user-formatter.util';
import { VoteTransactionCalculatorService } from '../../api-v1/common/services/vote-transaction-calculator.service';
import { UserFormatter } from '../../api-v1/common/utils/user-formatter.util';

export const commentsRouter = router({
  /**
   * Get comment by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Comments can be either Comment entities or Vote objects (votes contain comments)
      // Try to get as comment first, then as vote
      let comment: any = null;
      let vote: any = null;

      try {
        comment = await ctx.commentService.getComment(input.id);
      } catch (_err) {
        // Comment not found, might be a vote
      }

      if (!comment) {
        // Try to get as vote
        try {
          vote = await ctx.voteService.getVoteById(input.id);
        } catch (_err) {
          // Vote not found either
        }
      }

      if (!comment && !vote) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Comment not found',
        });
      }

      const entity = comment || vote;
      const authorId = comment 
        ? comment.getAuthorId.getValue()
        : vote.userId;

      // Fetch author
      const usersMap = await ctx.userEnrichmentService.batchFetchUsers([authorId]);

      // Calculate permissions
      const permissions = await ctx.permissionsHelperService.calculateCommentPermissions(
        ctx.user?.id || null,
        input.id,
      );

      // Map to API format
      const mappedComment = EntityMappers.mapCommentToApi(
        entity,
        usersMap,
      );

      return {
        ...mappedComment,
        permissions,
      };
    }),

  /**
   * Get comments by publication ID
   * Note: Comments on publications are actually votes with comments
   */
  getByPublicationId: publicProcedure
    .input(z.object({
      publicationId: z.string(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
      sort: z.string().optional(),
      order: z.enum(['asc', 'desc']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const pagination = PaginationHelper.parseOptions({
        page: input.page,
        pageSize: input.pageSize,
        limit: input.limit,
      });
      const skip = PaginationHelper.getSkip(pagination);
      const sortField = input.sort || 'createdAt';
      const sortOrder = (input.order || 'desc') === 'asc' ? 'asc' : 'desc';

      // Get votes on this publication (votes now contain comments)
      const votes = await ctx.voteService.getPublicationVotes(
        input.publicationId,
        pagination.limit || 20,
        skip,
        sortField,
        sortOrder,
      );

      // Extract unique user IDs (vote authors)
      const userIdsArray = Array.from(
        new Set(votes.map((v) => v.userId).filter(Boolean)),
      );

      // Batch fetch all users using enrichment service
      const usersMap = await ctx.userEnrichmentService.batchFetchUsers(userIdsArray);

      // Get publication to get slug and communityId
      const publication = await ctx.publicationService.getPublication(input.publicationId);
      const publicationSlug = publication?.getId.getValue();
      const communityId = publication?.getCommunityId.getValue();

      // Batch fetch votes on votes (for nested replies)
      const voteIds = votes.map((v) => v.id);
      const votesOnVotesMap = await ctx.voteService.getVotesOnVotes(voteIds);

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
          return sum + (r.direction === 'up' ? total : -total);
        }, 0);
        const upvotes = replies.filter((r) => r.direction === 'up').length;
        const downvotes = replies.filter((r) => r.direction === 'down').length;

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

      // Batch calculate permissions for all comments (votes)
      const commentIds = enrichedComments.map((comment) => comment.id);
      const permissionsMap = await ctx.permissionsHelperService.batchCalculateCommentPermissions(
        ctx.user?.id || null,
        commentIds,
      );

      // Add permissions to each comment
      enrichedComments.forEach((comment) => {
        comment.permissions = permissionsMap.get(comment.id);
      });

      // Get total count for pagination
      const totalVotes = await ctx.voteService.getVotesOnPublication(input.publicationId);
      const total = totalVotes.length;

      return {
        data: enrichedComments,
        total,
        skip,
        limit: pagination.limit || 20,
      };
    }),

  /**
   * Get replies to a comment (votes on a vote)
   */
  getReplies: publicProcedure
    .input(z.object({
      id: z.string(), // This is a vote ID
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
      sort: z.string().optional(),
      order: z.enum(['asc', 'desc']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const pagination = PaginationHelper.parseOptions({
        page: input.page,
        pageSize: input.pageSize,
        limit: input.limit,
      });
      const skip = PaginationHelper.getSkip(pagination);
      const sortField = input.sort || 'createdAt';
      const sortOrder = (input.order || 'desc') === 'asc' ? 'asc' : 'desc';

      // Get votes on this vote (id is a vote ID)
      const votes = await ctx.voteService.getVotesOnVote(input.id);

      // Sort votes
      votes.sort((a, b) => {
        if (sortField === 'createdAt') {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        } else if (sortField === 'score') {
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
      const limit = pagination.limit ?? 20;
      const paginatedVotes = votes.slice(skip, skip + limit);

      // Extract unique user IDs (vote authors)
      const userIdsArray = Array.from(
        new Set(paginatedVotes.map((v) => v.userId).filter(Boolean)),
      );

      // Batch fetch all users using enrichment service
      const usersMap = await ctx.userEnrichmentService.batchFetchUsers(userIdsArray);

      // Batch fetch votes on votes (for nested replies)
      const voteIds = paginatedVotes.map((v) => v.id);
      const votesOnVotesMap = await ctx.voteService.getVotesOnVotes(voteIds);

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
          return sum + (r.direction === 'up' ? total : -total);
        }, 0);
        const upvotes = replies.filter((r) => r.direction === 'up').length;
        const downvotes = replies.filter((r) => r.direction === 'down').length;

        return {
          ...baseComment,
          targetType: 'vote',
          targetId: input.id, // The parent vote ID
          // Metrics from votes on this vote (replies)
          metrics: {
            upvotes,
            downvotes,
            score,
            replyCount,
          },
        };
      });

      // Batch calculate permissions for all replies (votes)
      const replyIds = enrichedReplies.map((reply) => reply.id);
      const permissionsMap = await ctx.permissionsHelperService.batchCalculateCommentPermissions(
        ctx.user?.id || null,
        replyIds,
      );

      // Add permissions to each reply
      enrichedReplies.forEach((reply) => {
        reply.permissions = permissionsMap.get(reply.id);
      });

      return {
        data: enrichedReplies,
        total: votes.length,
        skip,
        limit,
      };
    }),

  /**
   * Create comment
   */
  create: protectedProcedure
    .input(CreateCommentDtoSchema)
    .mutation(async ({ ctx, input }) => {
      // Check feature flag for image uploads
      const commentImageUploadsEnabled = process.env.ENABLE_COMMENT_IMAGE_UPLOADS === 'true' || 
                                         process.env.NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS === 'true';
      if (!commentImageUploadsEnabled && input.images && input.images.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Image uploads in votes/comments are disabled',
        });
      }

      // Check permissions using PermissionService
      // For comments, we need to resolve the publication ID first
      let publicationId: string | undefined;
      if (input.targetType === 'publication') {
        publicationId = input.targetId;
      } else {
        // Comment on comment - need to resolve to publication
        const parentComment = await ctx.commentService.getComment(input.targetId);
        if (!parentComment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Parent comment not found',
          });
        }

        // Traverse up to find publication
        let currentComment = parentComment;
        let depth = 0;
        const maxDepth = 20;

        while (currentComment.getTargetType === 'comment' && depth < maxDepth) {
          const nextComment = await ctx.commentService.getComment(
            currentComment.getTargetId,
          );
          if (!nextComment) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Comment in chain not found',
            });
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
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Publication for comment not found',
          });
        }
      }

      // Check if user can comment
      const canComment = await ctx.permissionService.canComment(
        ctx.user.id,
        publicationId,
      );
      if (!canComment) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to comment on this publication',
        });
      }

      const comment = await ctx.commentService.createComment(
        ctx.user.id,
        input,
      );

      // Fetch author data (should be current user)
      const authorId = comment.getAuthorId.getValue();
      const usersMap = await ctx.userEnrichmentService.batchFetchUsers([authorId]);

      // Map to API format
      const mappedComment = EntityMappers.mapCommentToApi(
        comment,
        usersMap,
      );

      return mappedComment;
    }),

  /**
   * Update comment
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      data: UpdateCommentDtoSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permissions before updating
      const canEdit = await ctx.permissionService.canEditComment(
        ctx.user.id,
        input.id,
      );
      if (!canEdit) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to edit this comment',
        });
      }

      if (!input.data.content) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Content is required',
        });
      }

      const updatedComment = await ctx.commentService.updateComment(
        input.id,
        ctx.user.id,
        { content: input.data.content },
      );

      // Extract author ID for enrichment
      const authorId = updatedComment.getAuthorId.getValue();

      // Batch fetch users for enrichment
      const usersMap = await ctx.userEnrichmentService.batchFetchUsers([authorId]);

      // Map domain entity to API format
      const mappedComment = EntityMappers.mapCommentToApi(
        updatedComment,
        usersMap,
      );

      return mappedComment;
    }),

  /**
   * Delete comment
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.commentService.deleteComment(input.id, ctx.user.id);
      return { success: true, message: 'Comment deleted successfully' };
    }),

  /**
   * Get comments by user ID
   */
  getByUserId: publicProcedure
    .input(z.object({
      userId: z.string(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      skip: z.number().int().min(0).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const pagination = PaginationHelper.parseOptions({
        page: input.page,
        pageSize: input.pageSize,
        limit: input.limit,
      });
      const skip = PaginationHelper.getSkip(pagination);

      // Get comments by author
      const comments = await ctx.commentService.getCommentsByAuthor(
        input.userId,
        pagination.limit || 20,
        skip,
      );

      // Extract unique author IDs
      const authorIds = Array.from(
        new Set(comments.map((comment) => comment.getAuthorId.getValue()).filter(Boolean)),
      );

      // Batch fetch all authors using enrichment service
      const usersMap = await ctx.userEnrichmentService.batchFetchUsers(authorIds);

      // Extract unique publication IDs for comments targeting publications
      const publicationIds = Array.from(
        new Set(
          comments
            .filter((comment) => comment.getTargetType === 'publication')
            .map((comment) => comment.getTargetId),
        ),
      );

      // Batch fetch all publications to get slugs and community IDs
      const publicationsMap = new Map<string, { id: string; slug: string; communityId: string }>();
      await Promise.all(
        publicationIds.map(async (publicationId) => {
          try {
            const publication = await ctx.publicationService.getPublication(publicationId);
            if (publication) {
              publicationsMap.set(publicationId, {
                id: publication.getId.getValue(),
                slug: publication.getId.getValue(), // Use ID as slug
                communityId: publication.getCommunityId.getValue(),
              });
            }
          } catch (_error) {
            // Silently fail - publication might not exist
          }
        }),
      );

      // Enrich comments with author metadata and publication data using EntityMappers
      const enrichedComments = comments.map((comment) => {
        const _authorId = comment.getAuthorId.getValue();

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

      // Get total count (need to query separately)
      // Note: This is a simplified approach - for better performance, consider caching or optimizing
      const totalComments = await ctx.connection.db
        ?.collection('comments')
        .countDocuments({ authorId: input.userId })
        || comments.length;

      return PaginationHelper.createResult(
        enrichedComments,
        totalComments,
        pagination,
      );
    }),

  /**
   * Get comment details with full enrichment (author, beneficiary, community, metrics, withdrawals)
   */
  getDetails: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { vote, snapshot, authorId } =
        await ctx.voteCommentResolverService.resolve(input.id);

      // Fetch author data
      const author = await ctx.commentEnrichmentService.fetchAuthor(authorId);

      // Fetch beneficiary and community
      const { beneficiary, community } =
        await ctx.commentEnrichmentService.fetchBeneficiaryAndCommunity(vote, authorId);

      // Calculate vote transaction data
      const voteTransactionData =
        VoteTransactionCalculatorService.calculate(vote);

      // Fetch votes on the vote/comment itself (for metrics)
      let commentVotes: any[] = [];
      try {
        if (vote) {
          // If this is a vote, get votes on this vote
          commentVotes = await ctx.voteService.getVotesOnVote(input.id);
        } else {
          // For regular comments (legacy), try to get votes (though this might not work anymore)
          commentVotes = await ctx.voteService.getTargetVotes('comment', input.id);
        }
      } catch (_error) {
        // Silently fail - votes might not exist
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
          totalReceived = await ctx.voteService.getPositiveSumForVote(input.id);
        }
      } catch (_err) {
        // Silently fail
      }
      try {
        // Sum of all withdrawals referencing this vote/comment
        const withdrawalType = vote ? 'vote_withdrawal' : 'comment_withdrawal';
        // Check if walletService has getTotalWithdrawnByReference method
        if ((ctx.walletService as any)?.getTotalWithdrawnByReference) {
          totalWithdrawn = await (ctx.walletService as any).getTotalWithdrawnByReference(
            withdrawalType,
            input.id,
          );
        }
      } catch (_err) {
        // Silently fail
      }

      // Calculate permissions
      const permissions = await ctx.permissionsHelperService.calculateCommentPermissions(
        ctx.user?.id || null,
        input.id,
      );

      return {
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
        permissions,
      };
    }),
});
