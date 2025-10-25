import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CommentServiceV2 } from '../../domain/services/comment.service-v2';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';

@Controller('api/v1/comments')
@UseGuards(UserGuard)
export class CommentsController {
  constructor(
    private commentService: CommentServiceV2,
  ) {}

  @Post()
  async createComment(
    @User() user: any,
    @Body() dto: {
      targetType: 'publication' | 'comment';
      targetId: string;
      parentCommentId?: string;
      content: string;
    },
  ) {
    return this.commentService.createComment(user.id, dto);
  }

  @Get(':id')
  async getComment(@Param('id') id: string) {
    return this.commentService.getComment(id);
  }

  @Get()
  async getComments(
    @Query('targetType') targetType?: 'publication' | 'comment',
    @Query('targetId') targetId?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;

    if (targetType && targetId) {
      return this.commentService.getCommentsByTarget(targetType, targetId, parsedLimit, parsedSkip);
    }

    return [];
  }

  @Get('replies/:parentCommentId')
  async getReplies(
    @Param('parentCommentId') parentCommentId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;

    return this.commentService.getCommentReplies(parentCommentId, parsedLimit, parsedSkip);
  }

  @Get('user/:authorId')
  async getUserComments(
    @Param('authorId') authorId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;

    return this.commentService.getCommentsByAuthor(authorId, parsedLimit, parsedSkip);
  }

  @Post(':id/vote')
  async voteOnComment(
    @User() user: any,
    @Param('id') id: string,
    @Body() dto: { amount: number; direction: 'up' | 'down' },
  ) {
    return this.commentService.voteOnComment(id, user.id, dto.amount, dto.direction);
  }

  @Delete(':id')
  async deleteComment(
    @User() user: any,
    @Param('id') id: string,
  ) {
    await this.commentService.deleteComment(id, user.id);
    return { success: true };
  }
}