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
import { PollService } from '../../domain/services/poll.service';
import { PollVoteService } from '../../domain/services/poll-vote.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Poll, CreatePollDto, CreatePollVoteDto } from '../../../../../../libs/shared-types/dist/index';

@Controller('api/v1/polls')
@UseGuards(UserGuard)
export class PollsController {
  private readonly logger = new Logger(PollsController.name);

  constructor(
    private readonly pollsService: PollService,
    private readonly pollVoteService: PollVoteService,
  ) {}

  @Get()
  async getPolls(@Query() query: any) {
    // For now, return empty array - this endpoint needs to be implemented based on business requirements
    return { data: [], total: 0, skip: 0, limit: 50 };
  }

  @Get(':id')
  async getPoll(@Param('id') id: string, @Req() req: any) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }
    const snapshot = poll.toSnapshot();
    
    // Transform domain Poll to API Poll format
    const apiPoll: Poll = {
      id: snapshot.id,
      authorId: snapshot.authorId,
      communityId: snapshot.communityId,
      question: snapshot.question,
      description: snapshot.description,
      options: snapshot.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes,
        amount: opt.amount || 0,
        voterCount: opt.voterCount,
      })),
      metrics: snapshot.metrics,
      expiresAt: snapshot.expiresAt.toISOString(),
      isActive: snapshot.isActive,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
    
    return { success: true, data: apiPoll };
  }

  @Post()
  async createPoll(
    @Body() createDto: CreatePollDto,
    @Req() req: any,
  ) {
    // Transform API CreatePollDto to domain CreatePollDto
    const domainDto = {
      ...createDto,
      expiresAt: new Date(createDto.expiresAt),
    } as any;
    
    const poll = await this.pollsService.createPoll(req.user.id, domainDto);
    const snapshot = poll.toSnapshot();
    
    // Transform domain Poll to API Poll format
    const apiPoll: Poll = {
      id: snapshot.id,
      authorId: snapshot.authorId,
      communityId: snapshot.communityId,
      question: snapshot.question,
      description: snapshot.description,
      options: snapshot.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        votes: opt.votes,
        amount: opt.amount || 0,
        voterCount: opt.voterCount,
      })),
      metrics: snapshot.metrics,
      expiresAt: snapshot.expiresAt.toISOString(),
      isActive: snapshot.isActive,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
    
    return { success: true, data: apiPoll };
  }

  @Put(':id')
  async updatePoll(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreatePollDto>,
    @Req() req: any,
  ): Promise<Poll> {
    // Update functionality not implemented yet
    throw new Error('Update poll functionality not implemented');
  }

  @Delete(':id')
  async deletePoll(@Param('id') id: string, @Req() req: any) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }

    if (poll.toSnapshot().authorId !== req.user.id) {
      throw new ForbiddenError('Only the author can delete this poll');
    }

    // Delete functionality not implemented yet
    throw new Error('Delete poll functionality not implemented');
  }

  @Post(':id/votes')
  async voteOnPoll(
    @Param('id') id: string,
    @Body() createDto: CreatePollVoteDto,
    @Req() req: any,
  ) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }
    
    const snapshot = poll.toSnapshot();
    const vote = await this.pollVoteService.createVote(
      id,
      req.user.id,
      createDto.optionId,
      createDto.amount,
      (createDto as any).sourceType || 'personal',
      snapshot.communityId
    );
    
    return { success: true, data: vote };
  }

  @Get(':id/results')
  async getPollResults(@Param('id') id: string, @Req() req: any) {
    const results = await this.pollsService.getPollResults(id);
    return { success: true, data: results };
  }

  @Get(':id/my-votes')
  async getMyPollVotes(@Param('id') id: string, @Req() req: any) {
    const votes = await this.pollsService.getUserVotes(id, req.user.id);
    return { success: true, data: votes };
  }

  @Get('communities/:communityId')
  async getCommunityPolls(
    @Param('communityId') communityId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const result = await this.pollsService.getPollsByCommunity(
      communityId,
      pagination.limit,
      skip
    );
    
    // Transform domain Polls to API Poll format
    const apiPolls: Poll[] = result.map(poll => {
      const snapshot = poll.toSnapshot();
      return {
        id: snapshot.id,
        authorId: snapshot.authorId,
        communityId: snapshot.communityId,
        question: snapshot.question,
        description: snapshot.description,
        options: snapshot.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          votes: opt.votes,
          amount: opt.amount || 0,
          voterCount: opt.voterCount,
        })),
        metrics: snapshot.metrics,
        expiresAt: snapshot.expiresAt.toISOString(),
        isActive: snapshot.isActive,
        createdAt: snapshot.createdAt.toISOString(),
        updatedAt: snapshot.updatedAt.toISOString(),
      };
    });
    
    return { 
      success: true, 
      data: { 
        data: apiPolls, 
        total: result.length, 
        skip, 
        limit: pagination.limit 
      } 
    };
  }
}
