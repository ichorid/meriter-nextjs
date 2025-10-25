import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { VoteRepository } from '../models/vote/vote.repository';
import { Vote } from '../models/vote/vote.schema';
import { VoteAmount, UserId } from '../value-objects';
import { uid } from 'uid';

@Injectable()
export class VoteService {
  private readonly logger = new Logger(VoteService.name);

  constructor(
    private voteRepository: VoteRepository,
  ) {}

  async createVote(
    userId: string,
    targetType: 'publication' | 'comment',
    targetId: string,
    amount: number,
    sourceType: 'personal' | 'quota'
  ): Promise<Vote> {
    this.logger.log(`Creating vote: user=${userId}, target=${targetType}:${targetId}, amount=${amount}`);

    // Validate vote amount
    const voteAmount = amount > 0 ? VoteAmount.up(amount) : VoteAmount.down(Math.abs(amount));

    // Check if user already voted on this target
    const existing = await this.voteRepository.findByUserAndTarget(userId, targetType, targetId);
    if (existing) {
      throw new BadRequestException('Already voted on this content');
    }

    const vote = await this.voteRepository.create({
      id: uid(),
      targetType,
      targetId,
      userId,
      amount: voteAmount.getNumericValue(),
      sourceType,
      createdAt: new Date(),
    });

    this.logger.log(`Vote created successfully: ${vote.id}`);
    return vote;
  }

  async removeVote(userId: string, targetType: 'publication' | 'comment', targetId: string): Promise<boolean> {
    this.logger.log(`Removing vote: user=${userId}, target=${targetType}:${targetId}`);

    const result = await this.voteRepository.deleteByUserAndTarget(userId, targetType, targetId);
    
    if (result) {
      this.logger.log(`Vote removed successfully`);
    }

    return result;
  }

  async getUserVotes(userId: string, limit: number = 100, skip: number = 0): Promise<Vote[]> {
    return this.voteRepository.findByUser(userId, limit, skip);
  }

  async getTargetVotes(targetType: string, targetId: string): Promise<Vote[]> {
    return this.voteRepository.findByTarget(targetType, targetId);
  }

  async hasUserVoted(userId: string, targetType: string, targetId: string): Promise<boolean> {
    const vote = await this.voteRepository.findByUserAndTarget(userId, targetType, targetId);
    return vote !== null;
  }

  async hasVoted(userId: string, targetType: 'publication' | 'comment', targetId: string): Promise<boolean> {
    return this.hasUserVoted(userId, targetType, targetId);
  }

  async createVoteFromDto(userId: string, dto: { targetType: 'publication' | 'comment'; targetId: string; amount: number }): Promise<Vote> {
    return this.createVote(userId, dto.targetType, dto.targetId, dto.amount, 'personal');
  }
}
