import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Poll } from '../aggregates/poll/poll.entity';
import { Poll as PollSchema, PollDocument } from '../models/poll/poll.schema';
import { PollVoteRepository } from '../models/poll/poll-vote.repository';
import { PollCreatedEvent } from '../events';
import { EventBus } from '../events/event-bus';

export interface CreatePollDto {
  communityId: string;
  question: string;
  options: string[];
  expiresAt: Date;
}

@Injectable()
export class PollServiceV2 {
  private readonly logger = new Logger(PollServiceV2.name);

  constructor(
    @InjectModel(PollSchema.name) private pollModel: Model<PollDocument>,
    private pollVoteRepository: PollVoteRepository,
    @InjectConnection() private mongoose: Connection,
    private eventBus: EventBus,
  ) {}

  async createPoll(userId: string, dto: CreatePollDto): Promise<Poll> {
    this.logger.log(`Creating poll: user=${userId}, community=${dto.communityId}`);

    // Validate expiration is in the future
    if (dto.expiresAt <= new Date()) {
      throw new BadRequestException('Poll expiration must be in the future');
    }

    // Create poll aggregate
    const poll = Poll.create(
      userId,
      dto.communityId,
      dto.question,
      dto.options,
      dto.expiresAt
    );

    // Save using Mongoose directly
    await this.pollModel.create(poll.toSnapshot());

    // Publish domain event
    await this.eventBus.publish(
      new PollCreatedEvent(poll.getId, dto.communityId, userId)
    );

    this.logger.log(`Poll created successfully: ${poll.getId}`);
    return poll;
  }

  async getPoll(id: string): Promise<Poll | null> {
    const doc = await this.pollModel.findOne({ id }).lean();
    return doc ? Poll.fromSnapshot(doc as any) : null;
  }

  async getPollsByCommunity(communityId: string, limit: number = 20, skip: number = 0): Promise<Poll[]> {
    const docs = await this.pollModel
      .find({ communityId, isActive: true })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    
    return docs.map(doc => Poll.fromSnapshot(doc as any));
  }

  async getActivePolls(limit: number = 20, skip: number = 0): Promise<Poll[]> {
    const docs = await this.pollModel
      .find({ isActive: true, expiresAt: { $gt: new Date() } })
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 })
      .lean();
    
    return docs.map(doc => Poll.fromSnapshot(doc as any));
  }

  async getPollResults(pollId: string): Promise<Array<{ optionIndex: number; totalAmount: number }>> {
    return this.pollVoteRepository.aggregateByOption(pollId);
  }

  async getUserVotes(pollId: string, userId: string) {
    return this.pollVoteRepository.findByPollAndUser(pollId, userId);
  }

  async expirePoll(pollId: string): Promise<Poll | null> {
    const session = await this.mongoose.startSession();
    session.startTransaction();

    try {
      const doc = await this.pollModel.findOne({ id: pollId }, null, { session }).lean();
      if (!doc) {
        throw new NotFoundException('Poll not found');
      }

      const poll = Poll.fromSnapshot(doc as any);
      
      if (poll.hasExpired()) {
        poll.expire();
        
        await this.pollModel.updateOne(
          { id: poll.getId },
          { $set: poll.toSnapshot() },
          { session }
        );
        
        await session.commitTransaction();
        return poll;
      }
      
      await session.commitTransaction();
      return poll;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async voteOnPoll(
    pollId: string,
    userId: string,
    optionIndex: number,
    amount: number,
  ): Promise<any> {
    // This is a simplified implementation
    // In reality, you'd create a poll vote document
    return {
      id: 'vote-' + Date.now(),
      pollId,
      userId,
      optionIndex,
      amount,
      createdAt: new Date(),
    };
  }
}
