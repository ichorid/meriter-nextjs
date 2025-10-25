import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { PollsService } from '../polls/polls.service';
import { PollVotesService } from '../services/poll-votes.service';
import { Poll, CreatePollDto, PollVote, CreatePollVoteDto } from '../types/domain.types';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { User } from '../../decorators/user.decorator';

@Controller('polls')
export class PollsController {
  constructor(
    private readonly pollsService: PollsService,
    private readonly pollVotesService: PollVotesService,
  ) {}

  @Get()
  async getPolls(@Query() query: any): Promise<PaginationResult<Poll>> {
    const pagination = PaginationHelper.parseOptions(query);
    return this.pollsService.getPolls(pagination, query);
  }

  @Get(':id')
  async getPoll(@Param('id') id: string, @User() user: any): Promise<Poll | null> {
    return this.pollsService.getPoll(id, user.id);
  }

  @Post()
  async createPoll(@Body() createDto: CreatePollDto, @User() user: any): Promise<Poll> {
    return this.pollsService.createPoll(createDto, user.id);
  }

  @Post(':id/vote')
  async voteOnPoll(
    @Param('id') pollId: string,
    @Body() createDto: CreatePollVoteDto,
    @User() user: any,
  ): Promise<PollVote> {
    return this.pollVotesService.createPollVote(createDto, user.id, createDto.communityId || '');
  }

  @Get(':id/results')
  async getPollResults(@Param('id') pollId: string, @User() user: any): Promise<any> {
    return this.pollsService.getPollResults(pollId, user.id);
  }

  @Get(':id/votes')
  async getPollVotes(@Param('id') pollId: string, @Query() query: any): Promise<PaginationResult<PollVote>> {
    const pagination = PaginationHelper.parseOptions(query);
    return this.pollVotesService.getPollVotes(pollId, pagination);
  }
}