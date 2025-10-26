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
import { PollServiceV2 } from '../../domain/services/poll.service-v2';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/exceptions/api.exceptions';
import { Poll, CreatePollDto, CreatePollVoteDto } from '../types/domain.types';

@Controller('api/v1/polls')
@UseGuards(UserGuard)
export class PollsController {
  private readonly logger = new Logger(PollsController.name);

  constructor(private readonly pollsService: PollServiceV2) {}

  @Get()
  async getPolls(@Query() query: any) {
    // For now, return empty array - this endpoint needs to be implemented based on business requirements
    return { data: [], total: 0, skip: 0, limit: 50 };
  }

  @Get(':id')
  async getPoll(@Param('id') id: string, @Req() req: any): Promise<Poll> {
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
      description: undefined, // Not available in domain entity
      options: snapshot.options.map((text, index) => ({
        id: `${snapshot.id}-${index}`,
        text,
        votes: 0, // TODO: Get actual vote counts
        voterCount: 0, // TODO: Get actual voter counts
      })),
      expiresAt: snapshot.expiresAt.toISOString(),
      isActive: snapshot.isActive,
      metrics: undefined, // TODO: Calculate metrics
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
    
    return apiPoll;
  }

  @Post()
  async createPoll(
    @Body() createDto: CreatePollDto,
    @Req() req: any,
  ): Promise<Poll> {
    // Transform API CreatePollDto to domain CreatePollDto
    const domainDto = {
      ...createDto,
      options: createDto.options.map(option => option.text),
      expiresAt: new Date(createDto.expiresAt),
    };
    
    const poll = await this.pollsService.createPoll(req.user.tgUserId, domainDto);
    const snapshot = poll.toSnapshot();
    
    // Transform domain Poll to API Poll format
    const apiPoll: Poll = {
      id: snapshot.id,
      authorId: snapshot.authorId,
      communityId: snapshot.communityId,
      question: snapshot.question,
      description: undefined, // Not available in domain entity
      options: snapshot.options.map((text, index) => ({
        id: `${snapshot.id}-${index}`,
        text,
        votes: 0, // TODO: Get actual vote counts
        voterCount: 0, // TODO: Get actual voter counts
      })),
      expiresAt: snapshot.expiresAt.toISOString(),
      isActive: snapshot.isActive,
      metrics: undefined, // TODO: Calculate metrics
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
    
    return apiPoll;
  }

  @Put(':id')
  async updatePoll(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreatePollDto>,
    @Req() req: any,
  ): Promise<Poll> {
    // Update functionality not implemented in V2 service yet
    throw new Error('Update poll functionality not implemented');
  }

  @Delete(':id')
  async deletePoll(@Param('id') id: string, @Req() req: any) {
    const poll = await this.pollsService.getPoll(id);
    if (!poll) {
      throw new NotFoundError('Poll', id);
    }

    if (poll.toSnapshot().authorId !== req.user.tgUserId) {
      throw new ForbiddenError('Only the author can delete this poll');
    }

    // Delete functionality not implemented in V2 service yet
    throw new Error('Delete poll functionality not implemented');
  }

  @Post(':id/votes')
  async voteOnPoll(
    @Param('id') id: string,
    @Body() createDto: CreatePollVoteDto,
    @Req() req: any,
  ) {
    return this.pollsService.voteOnPoll(id, req.user.tgUserId, createDto.amount, createDto.optionIndex);
  }

  @Get(':id/results')
  async getPollResults(@Param('id') id: string, @Req() req: any) {
    return this.pollsService.getPollResults(id);
  }

  @Get(':id/my-votes')
  async getMyPollVotes(@Param('id') id: string, @Req() req: any) {
    return this.pollsService.getUserVotes(id, req.user.tgUserId);
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
    return { data: result, total: result.length, skip, limit: pagination.limit };
  }
}
