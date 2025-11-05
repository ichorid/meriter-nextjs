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
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError } from '../../common/exceptions/api.exceptions';
import { Comment, CreateCommentDto, CreateCommentDtoSchema, UpdateCommentDtoSchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';

@Controller('api/v1/comments')
@UseGuards(UserGuard)
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);

  constructor(
    private readonly commentsService: CommentService,
    private readonly userService: UserService,
    private readonly voteService: VoteService,
    private readonly publicationService: PublicationService,
    private readonly communityService: CommunityService,
    private readonly walletService: WalletService,
  ) {}

  @Get()
  async getComments(@Query() query: any) {
    // For now, return empty array - this endpoint needs to be implemented based on business requirements
    return { data: [], total: 0, skip: 0, limit: 50 };
  }

  @Get(':id/details')
  async getCommentDetails(@Param('id') id: string, @Req() req: any) {
    // Check if this is a vote ID (votes now contain comments directly)
    let vote = await this.voteService.getVoteById(id);
    let snapshot: any = null;
    let authorId: string | undefined = undefined;
    
    if (vote) {
      // This is a vote - votes now contain comments directly
      authorId = vote.userId;
      snapshot = {
        id: vote.id,
        targetType: vote.targetType,
        targetId: vote.targetId,
        authorId: vote.userId,
        content: vote.comment || '',
        createdAt: vote.createdAt,
        updatedAt: vote.createdAt,
      };
    } else {
      // Regular comment (legacy)
      const comment = await this.commentsService.getComment(id);
      if (!comment) {
        throw new NotFoundError('Comment', id);
      }

      snapshot = comment.toSnapshot();
      authorId = comment.getAuthorId.getValue();
    }
    
    // Fetch author data
    let author = null;
    if (authorId) {
      try {
        author = await this.userService.getUser(authorId);
      } catch (error) {
        this.logger.warn(`Failed to fetch author ${authorId}:`, error.message);
      }
    }

    // vote is already set above if this is a vote ID
    let voteTransactionData = null;
    let beneficiary = null;
    let community = null;

    try {
      // If vote exists, fetch target and beneficiary
      if (vote) {
        // If vote is on a publication or vote, fetch target and beneficiary
        if (vote.targetType === 'publication') {
          const publication = await this.publicationService.getPublication(vote.targetId);
          if (publication) {
            // Get beneficiary (beneficiaryId if set, otherwise authorId)
            const beneficiaryId = publication.getBeneficiaryId?.getValue() || publication.getAuthorId.getValue();
            
            // Fetch beneficiary user
            if (beneficiaryId && beneficiaryId !== authorId) {
              try {
                const beneficiaryUser = await this.userService.getUser(beneficiaryId);
                if (beneficiaryUser) {
                  beneficiary = {
                    id: beneficiaryUser.id,
                    name: beneficiaryUser.displayName || `${beneficiaryUser.firstName || ''} ${beneficiaryUser.lastName || ''}`.trim() || beneficiaryUser.username || 'Unknown',
                    username: beneficiaryUser.username,
                    photoUrl: beneficiaryUser.avatarUrl,
                  };
                }
              } catch (error) {
                this.logger.warn(`Failed to fetch beneficiary ${beneficiaryId}:`, error.message);
              }
            }

            // Fetch community
            const communityId = publication.getCommunityId.getValue();
            if (communityId) {
              try {
                const communityData = await this.communityService.getCommunity(communityId);
                if (communityData) {
                  community = {
                    id: communityData.id,
                    name: communityData.name,
                    avatarUrl: communityData.avatarUrl,
                    iconUrl: communityData.settings?.iconUrl,
                  };
                }
              } catch (error) {
                this.logger.warn(`Failed to fetch community ${communityId}:`, error.message);
              }
            }
          }
        } else if (vote.targetType === 'vote') {
            // Vote is on another vote - fetch the target vote's author as beneficiary
            const targetVote = await this.voteService.getVoteById(vote.targetId);
            if (targetVote) {
              const targetAuthorId = targetVote.userId;
              if (targetAuthorId && targetAuthorId !== vote.userId) {
                try {
                  const beneficiaryUser = await this.userService.getUser(targetAuthorId);
                  if (beneficiaryUser) {
                    beneficiary = {
                      id: beneficiaryUser.id,
                      name: beneficiaryUser.displayName || `${beneficiaryUser.firstName || ''} ${beneficiaryUser.lastName || ''}`.trim() || beneficiaryUser.username || 'Unknown',
                      username: beneficiaryUser.username,
                      photoUrl: beneficiaryUser.avatarUrl,
                    };
                  }
                } catch (error) {
                  this.logger.warn(`Failed to fetch beneficiary ${targetAuthorId}:`, error.message);
                }
              }
              
              // Get community from the target vote
              const communityId = targetVote.communityId;
              if (communityId) {
                try {
                  const communityData = await this.communityService.getCommunity(communityId);
                  if (communityData) {
                    community = {
                      id: communityData.id,
                      name: communityData.name,
                      avatarUrl: communityData.avatarUrl,
                      iconUrl: communityData.settings?.iconUrl,
                    };
                  }
                } catch (error) {
                  this.logger.warn(`Failed to fetch community ${communityId}:`, error.message);
                }
              }
            }
          }

          // Prepare vote transaction data (for any vote)
          const voteAmountQuota = vote.amountQuota || 0;
          const voteAmountWallet = vote.amountWallet || 0;
          const voteAmount = voteAmountQuota + voteAmountWallet;
          // If quotaAmount > 0, it's an upvote (quota can only be used for upvotes)
          // If quotaAmount === 0, it could be a downvote (downvotes can only use wallet)
          const isUpvote = voteAmountQuota > 0;
          voteTransactionData = {
            amountTotal: voteAmount,
            plus: isUpvote ? voteAmount : 0,
            minus: isUpvote ? 0 : voteAmount,
            directionPlus: isUpvote,
            sum: isUpvote ? voteAmount : -voteAmount, // Negative for downvotes
          };
        }
    } catch (error) {
      this.logger.warn(`Failed to fetch vote for comment ${id}:`, error.message);
    }

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
      this.logger.warn(`Failed to fetch votes on comment ${id}:`, error.message);
    }

    // Calculate comment metrics from votes
    // Upvotes: quotaAmount > 0 (quota can only be used for upvotes)
    // Downvotes: quotaAmount === 0 and amountWallet > 0 (downvotes can only use wallet)
    const upvotes = commentVotes.filter(v => (v.amountQuota || 0) > 0).length;
    const downvotes = commentVotes.filter(v => (v.amountQuota || 0) === 0 && (v.amountWallet || 0) > 0).length;
    // Score: sum of upvote amounts minus sum of downvote amounts
    const score = commentVotes.reduce((sum, v) => {
      const quota = v.amountQuota || 0;
      const wallet = v.amountWallet || 0;
      const total = quota + wallet;
      // If quota > 0, it's an upvote (add to score)
      // If quota === 0, it's a downvote (subtract from score)
      return sum + (quota > 0 ? total : -total);
    }, 0);

    // Aggregated totals (avoid loading extra docs unnecessarily)
    let totalReceived = 0;
    let totalWithdrawn = 0;
    try {
      if (vote) {
        totalReceived = await this.voteService.getPositiveSumForVote(id);
      }
    } catch (err) {
      this.logger.warn(`Failed to aggregate positive votes for ${id}:`, err?.message || err);
    }
    try {
      // Sum of all withdrawals referencing this vote/comment
      const withdrawalType = vote ? 'vote_withdrawal' : 'comment_withdrawal';
      totalWithdrawn = await (this as any).walletService?.getTotalWithdrawnByReference
        ? await (this as any).walletService.getTotalWithdrawnByReference(withdrawalType, id)
        : 0;
    } catch (err) {
      this.logger.warn(`Failed to aggregate withdrawals for ${id}:`, err?.message || err);
    }

    const response = {
      comment: {
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      },
      author: author ? {
        id: author.id,
        name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
        username: author.username,
        photoUrl: author.avatarUrl,
      } : {
        id: undefined,
        name: 'Unknown',
        username: undefined,
        photoUrl: undefined,
      },
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

    return { success: true, data: response };
  }

  @Get(':id')
  async getComment(@Param('id') id: string, @Req() req: any) {
    // Check if this is a vote ID first (votes now contain comments directly)
    let vote = await this.voteService.getVoteById(id);
    let snapshot: any = null;
    let authorId: string | undefined = undefined;
    
    if (vote) {
      // This is a vote - votes now contain comments directly
      authorId = vote.userId;
      snapshot = {
        id: vote.id,
        targetType: vote.targetType,
        targetId: vote.targetId,
        authorId: vote.userId,
        content: vote.comment || '',
        createdAt: vote.createdAt,
        updatedAt: vote.createdAt,
      };
    } else {
      // Regular comment (legacy)
      const comment = await this.commentsService.getComment(id);
      if (!comment) {
        throw new NotFoundError('Comment', id);
      }
      
      snapshot = comment.toSnapshot();
      authorId = comment.getAuthorId.getValue();
    }
    
    // Fetch author data
    let author = null;
    if (authorId) {
      try {
        author = await this.userService.getUser(authorId);
      } catch (error) {
        this.logger.warn(`Failed to fetch author ${authorId}:`, error.message);
      }
    }
    
    // Calculate vote-related fields from associated vote
    const voteAmountQuota = vote ? (vote.amountQuota || 0) : 0;
    const voteAmountWallet = vote ? (vote.amountWallet || 0) : 0;
    const voteAmount = voteAmountQuota + voteAmountWallet;
    const isUpvote = vote && voteAmountQuota > 0;
    const isDownvote = vote && voteAmountQuota === 0 && voteAmountWallet > 0;

    const commentData = {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      meta: {
        author: author ? {
          name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
          username: author.username,
          photoUrl: author.avatarUrl,
        } : {
          name: 'Unknown',
          username: undefined,
          photoUrl: undefined,
        },
      },
      // Add vote transaction fields if comment is associated with a vote
      ...(vote && {
        amountTotal: voteAmount,
        plus: isUpvote ? voteAmount : 0,
        minus: isDownvote ? voteAmount : 0,
        directionPlus: isUpvote,
        sum: isUpvote ? voteAmount : -voteAmount, // Negative for downvotes
      }),
    };

    return { success: true, data: commentData };
  }

  @Post()
  @ZodValidation(CreateCommentDtoSchema)
  async createComment(
    @Body() createDto: CreateCommentDto,
    @Req() req: any,
  ): Promise<Comment> {
    const comment = await this.commentsService.createComment(req.user.id, createDto);
    
    // Fetch author data (should be current user)
    const authorId = comment.getAuthorId.getValue();
    let author = null;
    if (authorId) {
      try {
        author = await this.userService.getUser(authorId);
      } catch (error) {
        this.logger.warn(`Failed to fetch author ${authorId}:`, error.message);
      }
    }

    const snapshot = comment.toSnapshot();
    return {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      meta: {
        author: author ? {
          name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
          username: author.username,
          photoUrl: author.avatarUrl,
        } : {
          name: 'Unknown',
          username: undefined,
          photoUrl: undefined,
        },
      },
    };
  }

  @Put(':id')
  @ZodValidation(UpdateCommentDtoSchema)
  async updateComment(
    @Param('id') id: string,
    @Body() updateDto: any,
    @Req() req: any,
  ): Promise<Comment> {
    // Update functionality not implemented yet
    throw new Error('Update comment functionality not implemented');
  }

  @Delete(':id')
  async deleteComment(@Param('id') id: string, @Req() req: any) {
    const comment = await this.commentsService.getComment(id);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }

    const commentSnapshot = comment.toSnapshot();
    if (commentSnapshot.authorId !== req.user.id) {
      throw new ForbiddenError('Only the author can delete this comment');
    }

    await this.commentsService.deleteComment(id, req.user.id);
    return { success: true, data: { message: 'Comment deleted successfully' } };
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
      sortOrder
    );

    // Extract unique user IDs (vote authors)
    const userIds = new Set<string>();
    votes.forEach(vote => {
      if (vote.userId) {
        userIds.add(vote.userId);
      }
    });

    // Batch fetch all users
    const usersMap = new Map<string, any>();
    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        try {
          const user = await this.userService.getUser(userId);
          if (user) {
            usersMap.set(userId, user);
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch user ${userId}:`, error.message);
        }
      })
    );

    // Get publication to get slug and communityId
    const publication = await this.publicationService.getPublication(publicationId);
    const publicationSlug = publication?.getId.getValue();
    const communityId = publication?.getCommunityId.getValue();

    // Batch fetch votes on votes (for nested replies)
    const voteIds = votes.map(v => v.id);
    const votesOnVotesMap = await this.voteService.getVotesOnVotes(voteIds);

    // Convert votes to comment-like objects
    const enrichedComments = votes.map(vote => {
      const author = usersMap.get(vote.userId);
      const voteAmountQuota = vote.amountQuota || 0;
      const voteAmountWallet = vote.amountWallet || 0;
      const voteAmount = voteAmountQuota + voteAmountWallet;
      const isUpvote = voteAmountQuota > 0;
      const isDownvote = voteAmountQuota === 0 && voteAmountWallet > 0;
      
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
      const upvotes = replies.filter(r => (r.amountQuota || 0) > 0).length;
      const downvotes = replies.filter(r => (r.amountQuota || 0) === 0 && (r.amountWallet || 0) > 0).length;

      return {
        id: vote.id,
        _id: vote.id,
        targetType: 'publication',
        targetId: publicationId,
        authorId: vote.userId,
        content: vote.comment || '',
        createdAt: vote.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: vote.createdAt?.toISOString() || new Date().toISOString(),
        publicationSlug,
        communityId,
        meta: {
          author: author ? {
            id: author.id,
            name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
            username: author.username,
            photoUrl: author.avatarUrl,
          } : {
            id: undefined,
            name: 'Unknown',
            username: undefined,
            photoUrl: undefined,
          },
        },
        // Vote transaction fields (the vote itself)
        amountTotal: voteAmount,
        plus: isUpvote ? voteAmount : 0,
        minus: isDownvote ? voteAmount : 0,
        directionPlus: isUpvote,
        sum: isUpvote ? voteAmount : -voteAmount,
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
    const totalVotes = await this.voteService.getVotesOnPublication(publicationId);
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
        const scoreA = (a.amountQuota || 0) + (a.amountWallet || 0);
        const scoreB = (b.amountQuota || 0) + (b.amountWallet || 0);
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }
      return 0;
    });
    
    // Apply pagination
    const paginatedVotes = votes.slice(skip, skip + pagination.limit);

    // Extract unique user IDs (vote authors)
    const userIds = new Set<string>();
    paginatedVotes.forEach(vote => {
      if (vote.userId) {
        userIds.add(vote.userId);
      }
    });

    // Batch fetch all users
    const usersMap = new Map<string, any>();
    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        try {
          const user = await this.userService.getUser(userId);
          if (user) {
            usersMap.set(userId, user);
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch user ${userId}:`, error.message);
        }
      })
    );

    // Batch fetch votes on votes (for nested replies)
    const voteIds = paginatedVotes.map(v => v.id);
    const votesOnVotesMap = await this.voteService.getVotesOnVotes(voteIds);

    // Convert votes to comment-like objects
    const enrichedReplies = paginatedVotes.map(vote => {
      const author = usersMap.get(vote.userId);
      const voteAmountQuota = vote.amountQuota || 0;
      const voteAmountWallet = vote.amountWallet || 0;
      const voteAmount = voteAmountQuota + voteAmountWallet;
      const isUpvote = voteAmountQuota > 0;
      const isDownvote = voteAmountQuota === 0 && voteAmountWallet > 0;
      
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
      const upvotes = replies.filter(r => (r.amountQuota || 0) > 0).length;
      const downvotes = replies.filter(r => (r.amountQuota || 0) === 0 && (r.amountWallet || 0) > 0).length;

      return {
        id: vote.id,
        _id: vote.id,
        targetType: 'vote',
        targetId: id, // The parent vote ID
        authorId: vote.userId,
        content: vote.comment || '',
        createdAt: vote.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: vote.createdAt?.toISOString() || new Date().toISOString(),
        meta: {
          author: author ? {
            id: author.id,
            name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
            username: author.username,
            photoUrl: author.avatarUrl,
          } : {
            id: undefined,
            name: 'Unknown',
            username: undefined,
            photoUrl: undefined,
          },
        },
        // Vote transaction fields (the vote itself)
        amountTotal: voteAmount,
        plus: isUpvote ? voteAmount : 0,
        minus: isDownvote ? voteAmount : 0,
        directionPlus: isUpvote,
        sum: isUpvote ? voteAmount : -voteAmount,
        // Metrics from votes on this vote (replies)
        metrics: {
          upvotes,
          downvotes,
          score,
          replyCount,
        },
      };
    });

    return { data: enrichedReplies, total: votes.length, skip, limit: pagination.limit };
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
      skip
    );

    // Extract unique author IDs
    const authorIds = new Set<string>();
    comments.forEach(comment => {
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
      })
    );

    // Extract unique publication IDs for comments targeting publications
    const publicationIds = new Set<string>();
    comments.forEach(comment => {
      if (comment.getTargetType === 'publication') {
        publicationIds.add(comment.getTargetId);
      }
    });

    // Batch fetch all publications to get slugs and community IDs
    const publicationsMap = new Map<string, any>();
    await Promise.all(
      Array.from(publicationIds).map(async (publicationId) => {
        try {
          const publication = await this.publicationService.getPublication(publicationId);
          if (publication) {
            publicationsMap.set(publicationId, {
              id: publication.getId.getValue(),
              slug: publication.getId.getValue(), // Use ID as slug
              communityId: publication.getCommunityId.getValue(),
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch publication ${publicationId}:`, error.message);
        }
      })
    );

    // Enrich comments with author metadata and publication data
    // Note: Legacy comments don't have votes attached anymore, votes are separate
    const enrichedComments = comments.map(comment => {
      const snapshot = comment.toSnapshot();
      const authorId = comment.getAuthorId.getValue();
      const author = usersMap.get(authorId);
      
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
      
      return {
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
        publicationSlug,
        communityId,
        meta: {
          author: author ? {
            id: author.id,
            name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
            username: author.username,
            photoUrl: author.avatarUrl,
          } : {
            id: undefined,
            name: 'Unknown',
            username: undefined,
            photoUrl: undefined,
          },
        },
      };
    });

    return { data: enrichedComments, total: enrichedComments.length, skip, limit: pagination.limit };
  }
}
