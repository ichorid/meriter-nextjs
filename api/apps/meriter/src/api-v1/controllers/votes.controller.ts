import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { VoteService } from '../../domain/services/vote.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';

@Controller('api/v1/votes')
@UseGuards(UserGuard)
export class VotesController {
  constructor(
    private voteService: VoteService,
  ) {}

  @Post()
  async createVote(
    @User() user: any,
    @Body() dto: {
      targetType: 'publication' | 'comment';
      targetId: string;
      amount: number;
      sourceType: 'personal' | 'quota';
    },
  ) {
    return this.voteService.createVote(user.id, dto.targetType, dto.targetId, dto.amount, dto.sourceType);
  }

  @Delete()
  async removeVote(
    @User() user: any,
    @Query('targetType') targetType: 'publication' | 'comment',
    @Query('targetId') targetId: string,
  ) {
    const result = await this.voteService.removeVote(user.id, targetType, targetId);
    return { success: result };
  }

  @Get('user')
  async getUserVotes(
    @User() user: any,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;

    return this.voteService.getUserVotes(user.id, parsedLimit, parsedSkip);
  }

  @Get()
  async getTargetVotes(
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
  ) {
    return this.voteService.getTargetVotes(targetType, targetId);
  }

  @Get('has-voted')
  async hasUserVoted(
    @User() user: any,
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
  ) {
    const hasVoted = await this.voteService.hasUserVoted(user.id, targetType, targetId);
    return { hasVoted };
  }
}
