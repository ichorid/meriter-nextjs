import { Inject, Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PollCastRepository } from '../models/poll/poll-cast.repository';
import type { PollCast } from '../models/poll/poll-cast.schema';
import { PollCastedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import {
  POLL_PERSISTENCE_PORT,
  type PollPersistencePort,
} from '../ports/poll.persistence.port';
import { uid } from 'uid';

@Injectable()
export class PollCastService {
  private readonly logger = new Logger(PollCastService.name);

  constructor(
    private pollCastRepository: PollCastRepository,
    @Inject(POLL_PERSISTENCE_PORT)
    private readonly pollPersistence: PollPersistencePort,
    private eventBus: EventBus,
  ) {}

  async createCast(
    pollId: string,
    userId: string,
    optionId: string,
    quotaAmount: number,
    walletAmount: number,
    communityId: string,
  ): Promise<PollCast> {
    const totalAmount = quotaAmount + walletAmount;
    this.logger.log(
      `Creating poll cast: poll=${pollId}, user=${userId}, option=${optionId}, quota=${quotaAmount}, wallet=${walletAmount}, total=${totalAmount}`,
    );

    const poll = await this.pollPersistence.findById(pollId);
    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    if (!poll.isActive) {
      throw new BadRequestException('Poll is not active');
    }

    if (poll.expiresAt < new Date()) {
      throw new BadRequestException('Poll has expired');
    }

    const validOptionIds = poll.options.map((opt) => opt.id);
    if (!validOptionIds.includes(optionId)) {
      throw new BadRequestException('Invalid option ID');
    }

    if (totalAmount <= 0) {
      throw new BadRequestException('Cast amount must be positive');
    }
    if (quotaAmount <= 0 && walletAmount <= 0) {
      throw new BadRequestException('Cast amount must be positive (quota or wallet)');
    }

    const cast = await this.pollCastRepository.create({
      id: uid(),
      pollId,
      userId,
      optionId,
      amountQuota: quotaAmount,
      amountWallet: walletAmount,
      communityId,
      createdAt: new Date(),
    });

    await this.eventBus.publish(new PollCastedEvent(pollId, userId, optionId, totalAmount));

    this.logger.log(`Poll cast created successfully: ${cast.id}`);
    return cast;
  }

  async getUserCasts(pollId: string, userId: string): Promise<PollCast[]> {
    return this.pollCastRepository.findByPollAndUser(pollId, userId);
  }

  async getPollResults(
    pollId: string,
  ): Promise<Array<{ optionId: string; totalAmount: number; castCount: number }>> {
    return this.pollCastRepository.aggregateByOption(pollId);
  }

  async getAllCasts(pollId: string): Promise<PollCast[]> {
    return this.pollCastRepository.findByPoll(pollId);
  }

  async castPoll(
    pollId: string,
    userId: string,
    optionId: string,
    amount: number,
    communityId: string,
  ): Promise<PollCast> {
    return this.createCast(pollId, userId, optionId, 0, amount, communityId);
  }
}
