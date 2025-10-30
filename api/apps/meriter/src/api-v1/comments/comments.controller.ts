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
  ) {}

  @Get()
  async getComments(@Query() query: any) {
    // For now, return empty array - this endpoint needs to be implemented based on business requirements
    return { data: [], total: 0, skip: 0, limit: 50 };
  }

  @Get(':id/details')
  async getCommentDetails(@Param('id') id: string, @Req() req: any) {
    const comment = await this.commentsService.getComment(id);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }

    const snapshot = comment.toSnapshot();
    const authorId = comment.getAuthorId.getValue();
    
    // Fetch author data
    let author = null;
    if (authorId) {
      try {
        author = await this.userService.getUser(authorId);
      } catch (error) {
        this.logger.warn(`Failed to fetch author ${authorId}:`, error.message);
      }
    }

    // Fetch associated vote if this comment represents a vote transaction
    let vote = null;
    let voteTransactionData = null;
    let beneficiary = null;
    let community = null;

    try {
      const votes = await this.voteService.getVotesByAttachedComment(id);
      if (votes && votes.length > 0) {
        // Prefer vote by comment author
        const authorVote = votes.find((v: any) => v.userId === authorId);
        vote = authorVote || votes[0];

        // If vote is on a publication, fetch publication and beneficiary
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

          // Prepare vote transaction data
          const voteAmount = Math.abs(vote.amount);
          const isUpvote = vote.amount > 0;
          voteTransactionData = {
            amountTotal: voteAmount,
            plus: isUpvote ? voteAmount : 0,
            minus: isUpvote ? 0 : voteAmount,
            directionPlus: isUpvote,
            sum: vote.amount, // Can be negative for downvotes
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch vote for comment ${id}:`, error.message);
    }

    // Fetch votes on the comment itself (for metrics)
    let commentVotes = [];
    try {
      commentVotes = await this.voteService.getTargetVotes('comment', id);
    } catch (error) {
      this.logger.warn(`Failed to fetch votes on comment ${id}:`, error.message);
    }

    // Calculate comment metrics from votes
    const upvotes = commentVotes.filter(v => v.amount > 0).length;
    const downvotes = commentVotes.filter(v => v.amount < 0).length;
    const score = commentVotes.reduce((sum, v) => sum + v.amount, 0);

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
      },
    };

    return { success: true, data: response };
  }

  @Get(':id')
  async getComment(@Param('id') id: string, @Req() req: any) {
    const comment = await this.commentsService.getComment(id);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }
    
    // Fetch author data
    const authorId = comment.getAuthorId.getValue();
    let author = null;
    if (authorId) {
      try {
        author = await this.userService.getUser(authorId);
      } catch (error) {
        this.logger.warn(`Failed to fetch author ${authorId}:`, error.message);
      }
    }

    // Fetch associated vote if this comment represents a vote transaction
    let vote = null;
    try {
      const votes = await this.voteService.getVotesByAttachedComment(id);
      if (votes && votes.length > 0) {
        // Prefer vote by comment author
        const authorVote = votes.find((v: any) => v.userId === authorId);
        vote = authorVote || votes[0];
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch vote for comment ${id}:`, error.message);
    }

    const snapshot = comment.toSnapshot();
    
    // Calculate vote-related fields from associated vote
    const voteAmount = vote ? Math.abs(vote.amount) : 0;
    const isUpvote = vote && vote.amount > 0;
    const isDownvote = vote && vote.amount < 0;

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
        sum: vote.amount, // Can be negative for downvotes
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
    const comments = await this.commentsService.getCommentsByTarget(
      'publication',
      publicationId,
      pagination.limit,
      skip,
      sortField,
      sortOrder
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

    // Batch fetch all votes attached to these comments (comments representing vote transactions)
    // This avoids N+1 queries by fetching all votes in one query
    const commentIds = comments.map(c => c.getId);
    let votesMap = new Map<string, any[]>();
    
    try {
      // Fetch all votes that have these comments as attachedCommentId in a single query
      votesMap = await this.voteService.getVotesByAttachedComments(commentIds);
      
      // Also fetch votes on this publication that have attached comments, as a fallback
      const publicationVotes = await this.voteService.getVotesOnPublicationWithAttachedComments(publicationId);
      publicationVotes.forEach(vote => {
        if (vote.attachedCommentId && commentIds.includes(vote.attachedCommentId)) {
          const existing = votesMap.get(vote.attachedCommentId) || [];
          if (!existing.some(v => v.id === vote.id)) {
            existing.push(vote);
            votesMap.set(vote.attachedCommentId, existing);
          }
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to batch fetch votes for comments:`, error.message);
    }
    
    // Create a map of commentId -> vote (prefer vote by comment author, otherwise first vote)
    const commentVoteMap = new Map<string, any>();
    commentIds.forEach((commentId, index) => {
      const votes = votesMap.get(commentId) || [];
      if (votes.length > 0) {
        const comment = comments[index];
        const authorId = comment.getAuthorId.getValue();
        // Prefer vote created by the comment author
        const authorVote = votes.find((v: any) => v.userId === authorId);
        commentVoteMap.set(commentId, authorVote || votes[0]);
      }
    });

    // Enrich comments with author metadata and vote data
    const enrichedComments = comments.map(comment => {
      const snapshot = comment.toSnapshot();
      const authorId = comment.getAuthorId.getValue();
      const author = usersMap.get(authorId);
      const vote = commentVoteMap.get(comment.getId);
      
      // Calculate vote-related fields from associated vote
      const voteAmount = vote ? Math.abs(vote.amount) : 0;
      const isUpvote = vote && vote.amount > 0;
      const isDownvote = vote && vote.amount < 0;

      return {
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
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
        // Add vote transaction fields if comment is associated with a vote
        ...(vote && {
          amountTotal: voteAmount,
          plus: isUpvote ? voteAmount : 0,
          minus: isDownvote ? voteAmount : 0,
          directionPlus: isUpvote,
          sum: vote.amount, // Can be negative for downvotes
        }),
      };
    });

    return { data: enrichedComments, total: enrichedComments.length, skip, limit: pagination.limit };
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
    const comments = await this.commentsService.getCommentReplies(
      id,
      pagination.limit,
      skip,
      sortField,
      sortOrder
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

    // Batch fetch all votes attached to these reply comments
    // This avoids N+1 queries by fetching all votes in one query
    const commentIds = comments.map(c => c.getId);
    let votesMap = new Map<string, any[]>();
    
    try {
      // Fetch all votes that have these comments as attachedCommentId in a single query
      votesMap = await this.voteService.getVotesByAttachedComments(commentIds);
      
      // Also check votes on the parent comment that might have these replies attached
      try {
        const parentVotes = await this.voteService.getTargetVotes('comment', id);
        parentVotes.forEach(vote => {
          if (vote.attachedCommentId && commentIds.includes(vote.attachedCommentId)) {
            const existing = votesMap.get(vote.attachedCommentId) || [];
            if (!existing.some(v => v.id === vote.id)) {
              existing.push(vote);
              votesMap.set(vote.attachedCommentId, existing);
            }
          }
        });
      } catch (err) {
        this.logger.warn(`Failed to fetch parent comment votes:`, err);
      }
    } catch (error) {
      this.logger.warn(`Failed to batch fetch votes for comment replies:`, error.message);
    }
    
    // Create a map of commentId -> vote (prefer vote by comment author, otherwise first vote)
    const commentVoteMap = new Map<string, any>();
    commentIds.forEach((commentId, index) => {
      const votes = votesMap.get(commentId) || [];
      if (votes.length > 0) {
        const comment = comments[index];
        const authorId = comment.getAuthorId.getValue();
        // Prefer vote created by the comment author
        const authorVote = votes.find((v: any) => v.userId === authorId);
        commentVoteMap.set(commentId, authorVote || votes[0]);
      }
    });

    // Enrich comments with author metadata and vote data
    const enrichedComments = comments.map(comment => {
      const snapshot = comment.toSnapshot();
      const authorId = comment.getAuthorId.getValue();
      const author = usersMap.get(authorId);
      const vote = commentVoteMap.get(comment.getId);
      
      // Calculate vote-related fields from associated vote
      const voteAmount = vote ? Math.abs(vote.amount) : 0;
      const isUpvote = vote && vote.amount > 0;
      const isDownvote = vote && vote.amount < 0;

      return {
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
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
        // Add vote transaction fields if comment is associated with a vote
        ...(vote && {
          amountTotal: voteAmount,
          plus: isUpvote ? voteAmount : 0,
          minus: isDownvote ? voteAmount : 0,
          directionPlus: isUpvote,
          sum: vote.amount, // Can be negative for downvotes
        }),
      };
    });

    return { data: enrichedComments, total: enrichedComments.length, skip, limit: pagination.limit };
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

    // Batch fetch all votes attached to these comments (comments representing vote transactions)
    const commentIds = comments.map(c => c.getId);
    let votesMap = new Map<string, any[]>();
    
    try {
      // Fetch all votes that have these comments as attachedCommentId in a single query
      votesMap = await this.voteService.getVotesByAttachedComments(commentIds);
    } catch (error) {
      this.logger.warn(`Failed to batch fetch votes for comments:`, error.message);
    }
    
    // Create a map of commentId -> vote (prefer vote by comment author, otherwise first vote)
    const commentVoteMap = new Map<string, any>();
    commentIds.forEach((commentId, index) => {
      const votes = votesMap.get(commentId) || [];
      if (votes.length > 0) {
        const comment = comments[index];
        const authorId = comment.getAuthorId.getValue();
        // Prefer vote created by the comment author
        const authorVote = votes.find((v: any) => v.userId === authorId);
        commentVoteMap.set(commentId, authorVote || votes[0]);
      }
    });

    // Enrich comments with author metadata, publication data, and vote data
    const enrichedComments = comments.map(comment => {
      const snapshot = comment.toSnapshot();
      const authorId = comment.getAuthorId.getValue();
      const author = usersMap.get(authorId);
      const vote = commentVoteMap.get(comment.getId);
      
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
      
      // Calculate vote-related fields from associated vote
      const voteAmount = vote ? Math.abs(vote.amount) : 0;
      const isUpvote = vote && vote.amount > 0;
      const isDownvote = vote && vote.amount < 0;

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
        // Add vote transaction fields if comment is associated with a vote
        ...(vote && {
          amountTotal: voteAmount,
          plus: isUpvote ? voteAmount : 0,
          minus: isDownvote ? voteAmount : 0,
          directionPlus: isUpvote,
          sum: vote.amount, // Can be negative for downvotes
        }),
      };
    });

    return { data: enrichedComments, total: enrichedComments.length, skip, limit: pagination.limit };
  }
}
