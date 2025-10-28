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
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError } from '../../common/exceptions/api.exceptions';
import { Comment, CreateCommentDto } from '../../../../../../libs/shared-types/dist/index';

@Controller('api/v1/comments')
@UseGuards(UserGuard)
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);

  constructor(private readonly commentsService: CommentService) {}

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
    const snapshot = comment.toSnapshot();
    return {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  @Post()
  async createComment(
    @Body() createDto: CreateCommentDto,
    @Req() req: any,
  ): Promise<Comment> {
    const comment = await this.commentsService.createComment(req.user.id, createDto);
    const snapshot = comment.toSnapshot();
    return {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
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
    const result = await this.commentsService.getCommentsByTarget(
      'publication',
      publicationId,
      pagination.limit,
      skip
    );
    return { data: result, total: result.length, skip, limit: pagination.limit };
  }

  @Get(':id/replies')
  async getCommentReplies(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const result = await this.commentsService.getCommentReplies(
      id,
      pagination.limit,
      skip
    );
    return { data: result, total: result.length, skip, limit: pagination.limit };
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
