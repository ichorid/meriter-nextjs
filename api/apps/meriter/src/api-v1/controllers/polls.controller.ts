import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PollServiceV2 } from '../../domain/services/poll.service-v2';
import { PollVoteService } from '../../domain/services/poll-vote.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';

@Controller('api/v1/polls')
@UseGuards(UserGuard)
export class PollsController {
  constructor(
    private pollService: PollServiceV2,
    private pollVoteService: PollVoteService,
  ) {}

  @Post()
  async createPoll(
    @User() user: any,
    @Body() dto: {
      communityId: string;
      question: string;
      options: string[];
      expiresAt: string;
    },
  ) {
    return this.pollService.createPoll(user.id, {
      communityId: dto.communityId,
      question: dto.question,
      options: dto.options,
      expiresAt: new Date(dto.expiresAt),
    });
  }

  @Post(':id/votes')
  async voteOnPoll(
    @User() user: any,
    @Param('id') pollId: string,
    @Body() dto: {
      optionIndex: number;
      amount: number;
      sourceType: 'personal' | 'quota';
    },
  ) {
    return this.pollVoteService.createVote(pollId, user.id, dto.optionIndex, dto.amount, dto.sourceType);
  }

  @Get(':id')
  async getPoll(@Param('id') id: string) {
    return this.pollService.getPoll(id);
  }

  @Get(':id/results')
  async getPollResults(@Param('id') pollId: string) {
    return this.pollService.getPollResults(pollId);
  }

  @Get(':id/user-votes')
  async getUserVotes(@Param('id') pollId: string, @User() user: any) {
    return this.pollService.getUserVotes(pollId, user.id);
  }

  @Get('community/:communityId')
  async getPollsByCommunity(
    @Param('communityId') communityId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;

    return this.pollService.getPollsByCommunity(communityId, parsedLimit, parsedSkip);
  }

  @Get('active')
  async getActivePolls(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.pollService.getActivePolls(parsedLimit, 0);
  }
}
