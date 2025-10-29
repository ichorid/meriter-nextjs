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
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError } from '../../common/exceptions/api.exceptions';
import { Comment, CreateCommentDto } from '../../../../../../libs/shared-types/dist/index';

@Controller('api/v1/comments')
@UseGuards(UserGuard)
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);

  constructor(
    private readonly commentsService: CommentService,
    private readonly userService: UserService,
  ) {}

  @Get()
  async getComments(@Query() query: any) {
    // For now, return empty array - this endpoint needs to be implemented based on business requirements
    return { data: [], total: 0, skip: 0, limit: 50 };
  }

  @Get(':id')
  async getComment(@Param('id') id: string, @Req() req: any): Promise<Comment> {
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

    const snapshot = comment.toSnapshot();
    return {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
      meta: {
        author: author ? {
          name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
          username: author.username,
          telegramId: author.telegramId,
          photoUrl: author.avatarUrl,
        } : {
          name: 'Unknown',
          username: undefined,
          telegramId: undefined,
          photoUrl: undefined,
        },
      },
    };
  }

  @Post()
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
          telegramId: author.telegramId,
          photoUrl: author.avatarUrl,
        } : {
          name: 'Unknown',
          username: undefined,
          telegramId: undefined,
          photoUrl: undefined,
        },
      },
    };
  }

  @Put(':id')
  async updateComment(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateCommentDto>,
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
    const comments = await this.commentsService.getCommentsByTarget(
      'publication',
      publicationId,
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

    // Enrich comments with author metadata
    const enrichedComments = comments.map(comment => {
      const snapshot = comment.toSnapshot();
      const authorId = comment.getAuthorId.getValue();
      const author = usersMap.get(authorId);

      return {
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
        meta: {
          author: author ? {
            name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
            username: author.username,
            telegramId: author.telegramId,
            photoUrl: author.avatarUrl,
          } : {
            name: 'Unknown',
            username: undefined,
            telegramId: undefined,
            photoUrl: undefined,
          },
        },
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
    const comments = await this.commentsService.getCommentReplies(
      id,
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

    // Enrich comments with author metadata
    const enrichedComments = comments.map(comment => {
      const snapshot = comment.toSnapshot();
      const authorId = comment.getAuthorId.getValue();
      const author = usersMap.get(authorId);

      return {
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
        meta: {
          author: author ? {
            name: author.displayName || `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || 'Unknown',
            username: author.username,
            telegramId: author.telegramId,
            photoUrl: author.avatarUrl,
          } : {
            name: 'Unknown',
            username: undefined,
            telegramId: undefined,
            photoUrl: undefined,
          },
        },
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
    const result = await this.commentsService.getCommentsByAuthor(
      userId,
      pagination.limit,
      skip
    );
    return { data: result, total: result.length, skip, limit: pagination.limit };
  }
}
