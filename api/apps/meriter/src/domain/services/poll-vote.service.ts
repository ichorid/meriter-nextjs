import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollVoteRepository } from '../models/poll/poll-vote.repository';
import { Poll, PollDocument } from '../models/poll/poll.schema';
import { PollVote } from '../models/poll/poll-vote.schema';
import { PollVotedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { uid } from 'uid';

@Injectable()
export class PollVoteService {
  private readonly logger = new Logger(PollVoteService.name);

  constructor(
    private pollVoteRepository: PollVoteRepository,
    @InjectModel(Poll.name) private pollModel: Model<PollDocument>,
    private eventBus: EventBus,
  ) {}

  async createVote(
    pollId: string,
    userId: string,
    optionId: string,
    amount: number,
    sourceType: 'personal' | 'quota',
    communityId: string
  ): Promise<PollVote> {
    this.logger.log(`Creating poll vote: poll=${pollId}, user=${userId}, option=${optionId}, amount=${amount}`);

    // Validate poll exists and is active
    const poll = await this.pollModel.findOne({ id: pollId }).lean();
    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    if (!poll.isActive) {
      throw new BadRequestException('Poll is not active');
    }

    if (poll.expiresAt < new Date()) {
      throw new BadRequestException('Poll has expired');
    }

    // Validate option ID
    const validOptionIds = poll.options.map(opt => opt.id);
    if (!validOptionIds.includes(optionId)) {
      throw new BadRequestException('Invalid option ID');
    }

    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Vote amount must be positive');
    }

    const vote = await this.pollVoteRepository.create({
      id: uid(),
      pollId,
      userId,
      optionId,
      amount,
      sourceType,
      communityId,
      createdAt: new Date(),
    });

    // Publish event
    await this.eventBus.publish(
      new PollVotedEvent(pollId, userId, optionId, amount)
    );

    this.logger.log(`Poll vote created successfully: ${vote.id}`);
    return vote;
  }

  async getUserVotes(pollId: string, userId: string): Promise<PollVote[]> {
    return this.pollVoteRepository.findByPollAndUser(pollId, userId);
  }

  async getPollResults(pollId: string): Promise<Array<{ optionId: string; totalAmount: number; voteCount: number }>> {
    return this.pollVoteRepository.aggregateByOption(pollId);
  }

  async getAllVotes(pollId: string): Promise<PollVote[]> {
    return this.pollVoteRepository.findByPoll(pollId);
  }

  async voteOnPoll(pollId: string, userId: string, optionId: string, amount: number, communityId: string): Promise<PollVote> {
    return this.createVote(pollId, userId, optionId, amount, 'personal', communityId);
  }
}
