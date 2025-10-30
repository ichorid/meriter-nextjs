import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollCastRepository } from '../models/poll/poll-cast.repository';
import { Poll, PollDocument } from '../models/poll/poll.schema';
import { PollCast } from '../models/poll/poll-cast.schema';
import { PollCastedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import { uid } from 'uid';

@Injectable()
export class PollCastService {
  private readonly logger = new Logger(PollCastService.name);

  constructor(
    private pollCastRepository: PollCastRepository,
    @InjectModel(Poll.name) private pollModel: Model<PollDocument>,
    private eventBus: EventBus,
  ) {}

  async createCast(
    pollId: string,
    userId: string,
    optionId: string,
    amount: number,
    sourceType: 'personal' | 'quota',
    communityId: string
  ): Promise<PollCast> {
    this.logger.log(`Creating poll cast: poll=${pollId}, user=${userId}, option=${optionId}, amount=${amount}`);

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
      throw new BadRequestException('Cast amount must be positive');
    }

    const cast = await this.pollCastRepository.create({
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
      new PollCastedEvent(pollId, userId, optionId, amount)
    );

    this.logger.log(`Poll cast created successfully: ${cast.id}`);
    return cast;
  }

  async getUserCasts(pollId: string, userId: string): Promise<PollCast[]> {
    return this.pollCastRepository.findByPollAndUser(pollId, userId);
  }

  async getPollResults(pollId: string): Promise<Array<{ optionId: string; totalAmount: number; castCount: number }>> {
    return this.pollCastRepository.aggregateByOption(pollId);
  }

  async getAllCasts(pollId: string): Promise<PollCast[]> {
    return this.pollCastRepository.findByPoll(pollId);
  }

  async castPoll(pollId: string, userId: string, optionId: string, amount: number, communityId: string): Promise<PollCast> {
    return this.createCast(pollId, userId, optionId, amount, 'personal', communityId);
  }
}
