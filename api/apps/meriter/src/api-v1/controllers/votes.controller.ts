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
      direction: 'up' | 'down';
    },
  ) {
    return this.voteService.createVoteFromDto(user.id, dto);
  }

  @Delete()
  async removeVote(
    @User() user: any,
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
  ) {
    return this.voteService.removeVote(user.id, targetType as 'publication' | 'comment', targetId);
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
  async hasVoted(
    @User() user: any,
    @Query('targetType') targetType: string,
    @Query('targetId') targetId: string,
  ) {
    return this.voteService.hasVoted(user.id, targetType as 'publication' | 'comment', targetId);
  }
}