import { Injectable, Logger } from '@nestjs/common';
import { PollServiceV2 } from '../../domain/services/poll.service-v2';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Poll, CreatePollDto, CreatePollVoteDto, PollVote } from '../types/domain.types';

@Injectable()
export class PollsService {
  private readonly logger = new Logger(PollsService.name);

  constructor(
    private readonly pollServiceV2: PollServiceV2,
    private readonly tgBotsService: TgBotsService,
  ) {}

  async getPolls(pagination: any, filters: any): Promise<PaginationResult<Poll>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // Get polls by community if specified
    if (filters.communityId) {
      const polls = await this.pollServiceV2.getPollsByCommunity(
        filters.communityId,
        pagination.limit,
        skip
      );
      const mappedPolls = polls.map(poll => this.mapToPoll(poll));
      return PaginationHelper.createResult(mappedPolls, mappedPolls.length, pagination);
    }
    
    // Get active polls
    const polls = await this.pollServiceV2.getActivePolls(
      pagination.limit,
      skip
    );
    const mappedPolls = polls.map(poll => this.mapToPoll(poll));
    
    return PaginationHelper.createResult(mappedPolls, mappedPolls.length, pagination);
  }

  async getPoll(id: string, userId: string): Promise<Poll | null> {
    const poll = await this.pollServiceV2.getPoll(id);
    if (!poll) {
      return null;
    }

    // Check if user has access to this poll's community
    const communityId = poll.getCommunityId;
    const isMember = await this.tgBotsService.updateUserChatMembership(
      communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    return this.mapToPoll(poll);
  }

  async createPoll(createDto: CreatePollDto, userId: string): Promise<Poll> {
    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(
      createDto.communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    // Create poll using V2 service
    const poll = await this.pollServiceV2.createPoll(userId, {
      communityId: createDto.communityId,
      question: createDto.question,
      options: createDto.options.map(opt => opt.text),
      expiresAt: new Date(createDto.expiresAt),
    });

    return this.mapToPoll(poll);
  }

  async voteOnPoll(pollId: string, createDto: CreatePollVoteDto, userId: string): Promise<PollVote> {
    const poll = await this.pollServiceV2.getPoll(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    // Check if user has access to this poll's community
    const communityId = poll.getCommunityId;
    const isMember = await this.tgBotsService.updateUserChatMembership(
      communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    // Check if poll is expired
    if (poll.hasExpired()) {
      throw new Error('Poll has expired');
    }

    // Vote on poll using V2 service
    const pollVote = await this.pollServiceV2.voteOnPoll(
      pollId,
      userId,
      createDto.optionIndex,
      createDto.amount
    );

    return this.mapToPollVote(pollVote);
  }

  async getPollResults(pollId: string, userId: string): Promise<any> {
    const poll = await this.pollServiceV2.getPoll(pollId);
    if (!poll) {
      throw new Error('Poll not found');
    }

    // Check if user has access to this poll's community
    const communityId = poll.getCommunityId;
    const isMember = await this.tgBotsService.updateUserChatMembership(
      communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    // Get poll results using V2 service
    const results = await this.pollServiceV2.getPollResults(pollId);
    const userVotes = await this.pollServiceV2.getUserVotes(pollId, userId);

    return {
      poll: this.mapToPoll(poll),
      results,
      userVotes: userVotes.map(vote => this.mapToPollVote(vote)),
    };
  }

  async expirePoll(pollId: string): Promise<Poll | null> {
    const poll = await this.pollServiceV2.expirePoll(pollId);
    return poll ? this.mapToPoll(poll) : null;
  }

  private mapToPoll(poll: any): Poll {
    return {
      id: poll.getId?.getValue() || poll.id,
      authorId: poll.getAuthorId?.getValue() || poll.authorId,
      communityId: poll.getCommunityId?.getValue() || poll.communityId,
      question: poll.getQuestion?.() || poll.question,
      description: poll.getDescription?.() || poll.description,
      options: poll.getOptions?.() || poll.options || [],
      expiresAt: poll.getExpiresAt?.()?.toISOString() || poll.expiresAt?.toISOString() || new Date().toISOString(),
      isActive: poll.getIsActive?.() || poll.isActive || true,
      metrics: poll.getMetrics?.() || poll.metrics,
      createdAt: poll.getCreatedAt?.()?.toISOString() || poll.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: poll.getUpdatedAt?.()?.toISOString() || poll.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  async updatePoll(id: string, updateDto: Partial<CreatePollDto>): Promise<Poll | null> {
    // This is a simplified implementation
    const poll = await this.pollServiceV2.getPoll(id);
    return poll ? this.mapToPoll(poll) : null;
  }

  async deletePoll(id: string): Promise<boolean> {
    // This is a simplified implementation
    return true;
  }

  async createPollVote(pollId: string, createDto: CreatePollVoteDto, userId: string): Promise<PollVote> {
    return this.voteOnPoll(pollId, createDto, userId);
  }

  async getUserPollVotes(pollId: string, userId: string): Promise<PollVote[]> {
    const votes = await this.pollServiceV2.getUserVotes(pollId, userId);
    return votes.map(vote => this.mapToPollVote(vote));
  }

  async getCommunityPolls(
    communityId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Poll>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    const polls = await this.pollServiceV2.getPollsByCommunity(
      communityId,
      pagination.limit,
      skip
    );
    const mappedPolls = polls.map(poll => this.mapToPoll(poll));
    
    return PaginationHelper.createResult(mappedPolls, mappedPolls.length, pagination);
  }

  private mapToPollVote(pollVote: any): PollVote {
    return {
      id: pollVote.getId?.getValue() || pollVote.id,
      pollId: pollVote.getPollId?.getValue() || pollVote.pollId,
      userId: pollVote.getUserId?.getValue() || pollVote.userId,
      optionId: pollVote.getOptionId?.() || pollVote.optionId,
      optionIndex: pollVote.getOptionIndex?.() || pollVote.optionIndex,
      amount: pollVote.getAmount?.() || pollVote.amount,
      communityId: pollVote.getCommunityId?.() || pollVote.communityId,
      createdAt: pollVote.getCreatedAt?.()?.toISOString() || pollVote.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}