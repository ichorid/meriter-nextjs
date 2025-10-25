import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PollVoteRepository } from '../models/poll/poll-vote.repository';
import { PollRepository } from '../models/poll/poll.repository';
import { PollVote } from '../models/poll/poll-vote.schema';
import { PollVotedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PollVoteService {
  private readonly logger = new Logger(PollVoteService.name);

  constructor(
    private pollVoteRepository: PollVoteRepository,
    private pollRepository: PollRepository,
    private eventBus: EventBus,
  ) {}

  async createVote(
    pollId: string,
    userId: string,
    optionIndex: number,
    amount: number,
    sourceType: 'personal' | 'quota'
  ): Promise<PollVote> {
    this.logger.log(`Creating poll vote: poll=${pollId}, user=${userId}, option=${optionIndex}, amount=${amount}`);

    // Validate poll exists and is active
    const poll = await this.pollRepository.findById(pollId);
    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    if (!poll.isActive) {
      throw new BadRequestException('Poll is not active');
    }

    if (poll.expiresAt < new Date()) {
      throw new BadRequestException('Poll has expired');
    }

    // Validate option index
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new BadRequestException('Invalid option index');
    }

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Vote amount must be positive');
    }

    const vote = await this.pollVoteRepository.create({
      id: uuidv4(),
      pollId,
      userId,
      optionIndex,
      amount,
      sourceType,
      createdAt: new Date(),
    });

    // Publish event
    await this.eventBus.publish(
      new PollVotedEvent(pollId, userId, optionIndex, amount)
    );

    this.logger.log(`Poll vote created successfully: ${vote.id}`);
    return vote;
  }

  async getUserVotes(pollId: string, userId: string): Promise<PollVote[]> {
    return this.pollVoteRepository.findByPollAndUser(pollId, userId);
  }

  async getPollResults(pollId: string): Promise<Array<{ optionIndex: number; totalAmount: number; voteCount: number }>> {
    return this.pollVoteRepository.aggregateByOption(pollId);
  }

  async getAllVotes(pollId: string): Promise<PollVote[]> {
    return this.pollVoteRepository.findByPoll(pollId);
  }
}
