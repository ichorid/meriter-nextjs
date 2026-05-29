import { Inject, Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Poll } from '../aggregates/poll/poll.entity';
import { PollCastRepository } from '../models/poll/poll-cast.repository';
import { PollCreatedEvent } from '../events';
import { EventBus } from '../events/event-bus';
import {
  POLL_PERSISTENCE_PORT,
  type PollPersistencePort,
  type PollPartialUpdate,
} from '../ports/poll.persistence.port';
import { CreatePollDto, UpdatePollDto } from '../../../../../../libs/shared-types/dist/index';
import { uid } from 'uid';

@Injectable()
export class PollService {
  private readonly logger = new Logger(PollService.name);

  constructor(
    @Inject(POLL_PERSISTENCE_PORT)
    private readonly pollPersistence: PollPersistencePort,
    private pollCastRepository: PollCastRepository,
    private eventBus: EventBus,
  ) {}

  async createPoll(userId: string, dto: CreatePollDto): Promise<Poll> {
    this.logger.log(`Creating poll: user=${userId}, community=${dto.communityId}`);

    const expiresAt = typeof dto.expiresAt === 'string' ? new Date(dto.expiresAt) : dto.expiresAt;
    if (expiresAt <= new Date()) {
      throw new BadRequestException('Poll expiration must be in the future');
    }

    const poll = Poll.create(
      userId,
      dto.communityId,
      dto.question,
      dto.description,
      dto.options,
      expiresAt,
    );

    await this.pollPersistence.insertPoll(poll.toSnapshot());

    await this.eventBus.publish(new PollCreatedEvent(poll.getId, dto.communityId, userId));

    this.logger.log(`Poll created successfully: ${poll.getId}`);
    return poll;
  }

  async getPoll(id: string): Promise<Poll | null> {
    const doc = await this.pollPersistence.findById(id);
    return doc ? Poll.fromSnapshot(doc as any) : null;
  }

  async deletePoll(id: string): Promise<void> {
    await this.pollCastRepository.deleteByPoll(id);
    await this.pollPersistence.deleteById(id);
  }

  async countActivePollsByCommunity(communityId: string): Promise<number> {
    return this.pollPersistence.countActiveByCommunity(communityId);
  }

  async getPollsByCommunity(
    communityId: string,
    limit: number = 20,
    skip: number = 0,
    sortBy?: 'createdAt' | 'score',
    search?: string,
  ): Promise<Poll[]> {
    const docs = await this.pollPersistence.findByCommunity({
      communityId,
      limit,
      skip,
      sortBy,
      search,
    });
    return docs.map((doc) => Poll.fromSnapshot(doc as any));
  }

  async getActivePolls(limit: number = 20, skip: number = 0): Promise<Poll[]> {
    const docs = await this.pollPersistence.findActiveNotExpired(limit, skip);
    return docs.map((doc) => Poll.fromSnapshot(doc as any));
  }

  async getPollResults(pollId: string): Promise<Array<{ optionId: string; totalAmount: number }>> {
    return this.pollCastRepository.aggregateByOption(pollId);
  }

  async getUserCasts(pollId: string, userId: string) {
    return this.pollCastRepository.findByPollAndUser(pollId, userId);
  }

  async expirePoll(pollId: string): Promise<Poll | null> {
    const doc = await this.pollPersistence.findById(pollId);
    if (!doc) {
      throw new NotFoundException('Poll not found');
    }

    const poll = Poll.fromSnapshot(doc as any);

    if (poll.hasExpired()) {
      poll.expire();
      await this.pollPersistence.updateSnapshot(poll.getId, poll.toSnapshot());
      return poll;
    }

    return poll;
  }

  async updatePollForCast(
    pollId: string,
    optionId: string,
    amount: number,
    isNewCaster: boolean,
    isNewCasterForOption: boolean,
  ): Promise<Poll> {
    const doc = await this.pollPersistence.findById(pollId);
    if (!doc) {
      throw new NotFoundException('Poll not found');
    }

    const poll = Poll.fromSnapshot(doc as any);
    poll.addCast(optionId, amount, isNewCaster, isNewCasterForOption);
    await this.pollPersistence.updateSnapshot(poll.getId, poll.toSnapshot());

    this.logger.log(`Poll updated for cast: poll=${pollId}, option=${optionId}, amount=${amount}`);

    return poll;
  }

  private async buildPollsByUserFilter(userId: string): Promise<Record<string, unknown>> {
    const userCasts = await this.pollCastRepository.findByUser(userId, 1000, 0);
    const pollIdsWithCasts = [...new Set(userCasts.map((cast) => cast.pollId))];

    if (pollIdsWithCasts.length > 0) {
      return {
        $or: [{ authorId: userId }, { id: { $in: pollIdsWithCasts } }],
      };
    }
    return { authorId: userId };
  }

  async countPollsForUserProfile(userId: string): Promise<number> {
    const filter = await this.buildPollsByUserFilter(userId);
    return this.pollPersistence.countByFilter(filter);
  }

  async getPollsByUser(
    userId: string,
    limit: number = 20,
    skip: number = 0,
  ): Promise<Poll[]> {
    const filter = await this.buildPollsByUserFilter(userId);
    const docs = await this.pollPersistence.findByFilter(filter, limit, skip);
    return docs.map((doc) => Poll.fromSnapshot(doc as any));
  }

  async updatePoll(
    pollId: string,
    _userId: string,
    updateData: UpdatePollDto,
  ): Promise<Poll> {
    const doc = await this.pollPersistence.findById(pollId);
    if (!doc) {
      throw new NotFoundException('Poll not found');
    }

    const poll = Poll.fromSnapshot(doc as any);
    const metrics = poll.getMetrics;
    if (metrics.totalCasts > 0) {
      throw new BadRequestException('Cannot edit poll after votes have been cast');
    }

    const updateObj: PollPartialUpdate = {
      updatedAt: new Date(),
    };

    if (updateData.question !== undefined) {
      updateObj.question = updateData.question;
    }
    if (updateData.description !== undefined) {
      updateObj.description = updateData.description;
    }
    if (updateData.options !== undefined) {
      if (updateData.options.length < 2) {
        throw new BadRequestException('Poll must have at least 2 options');
      }

      const existingOptions = poll.getOptions;
      updateObj.options = updateData.options.map((opt, index) => {
        const existingOption =
          existingOptions[index] || existingOptions.find((o) => o.getId === opt.id);
        const optionId = existingOption?.getId || opt.id || uid();

        return {
          id: optionId,
          text: opt.text,
          votes: existingOption?.getVotes || 0,
          amount: existingOption?.getAmount || 0,
          casterCount: existingOption?.getCasterCount || 0,
        };
      });
    }
    if (updateData.expiresAt !== undefined) {
      const expiresAt =
        typeof updateData.expiresAt === 'string'
          ? new Date(updateData.expiresAt)
          : updateData.expiresAt;
      if (expiresAt <= new Date()) {
        throw new BadRequestException('Poll expiration must be in the future');
      }
      updateObj.expiresAt = expiresAt;
    }

    await this.pollPersistence.partialUpdate(pollId, updateObj);

    const updatedDoc = await this.pollPersistence.findById(pollId);
    if (!updatedDoc) {
      throw new NotFoundException('Poll not found after update');
    }

    this.logger.log(`Poll updated successfully: ${pollId}`);
    return Poll.fromSnapshot(updatedDoc as any);
  }
}
