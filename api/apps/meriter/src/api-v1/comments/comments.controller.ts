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
import { CommentsService } from './comments.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError } from '../../common/exceptions/api.exceptions';
import { Comment, CreateCommentDto } from '../types/domain.types';

@Controller('api/v1/comments')
@UseGuards(UserGuard)
export class CommentsController {
  private readonly logger = new Logger(CommentsController.name);

  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  async getComments(@Query() query: any) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.commentsService.getComments(pagination, query);
    return result;
  }

  @Get(':id')
  async getComment(@Param('id') id: string, @Req() req: any): Promise<Comment> {
    const comment = await this.commentsService.getComment(id, req.user.tgUserId);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }
    return comment;
  }

  @Post()
  async createComment(
    @Body() createDto: CreateCommentDto,
    @Req() req: any,
  ): Promise<Comment> {
    return this.commentsService.createComment(createDto, req.user.tgUserId);
  }

  @Put(':id')
  async updateComment(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateCommentDto>,
    @Req() req: any,
  ): Promise<Comment> {
    const comment = await this.commentsService.getComment(id, req.user.tgUserId);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }

    if (comment.authorId !== req.user.tgUserId) {
      throw new ForbiddenError('Only the author can update this comment');
    }

    return this.commentsService.updateComment(id, updateDto);
  }

  @Delete(':id')
  async deleteComment(@Param('id') id: string, @Req() req: any) {
    const comment = await this.commentsService.getComment(id, req.user.tgUserId);
    if (!comment) {
      throw new NotFoundError('Comment', id);
    }

    if (comment.authorId !== req.user.tgUserId) {
      throw new ForbiddenError('Only the author can delete this comment');
    }

    await this.commentsService.deleteComment(id);
    return { success: true, data: { message: 'Comment deleted successfully' } };
  }

  @Get('publications/:publicationId')
  async getPublicationComments(
    @Param('publicationId') publicationId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.commentsService.getPublicationComments(
      publicationId,
      pagination,
      req.user.tgUserId,
    );
    return result;
  }

  @Get(':id/replies')
  async getCommentReplies(
    @Param('id') id: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.commentsService.getCommentReplies(
      id,
      pagination,
      req.user.tgUserId,
    );
    return result;
  }

  @Get('users/:userId')
  async getUserComments(
    @Param('userId') userId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const result = await this.commentsService.getUserComments(
      userId,
      pagination,
      req.user.tgUserId,
    );
    return result;
  }
}
