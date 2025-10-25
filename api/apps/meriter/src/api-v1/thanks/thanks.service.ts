import { Injectable, Logger } from '@nestjs/common';
import { PublicationServiceV2 } from '../../domain/services/publication.service-v2';
import { CommentServiceV2 } from '../../domain/services/comment.service-v2';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { WalletServiceV2 } from '../../domain/services/wallet.service-v2';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Thank, CreateThankDto } from '../types/domain.types';

@Injectable()
export class ThanksService {
  private readonly logger = new Logger(ThanksService.name);

  constructor(
    private readonly publicationServiceV2: PublicationServiceV2,
    private readonly commentServiceV2: CommentServiceV2,
    private readonly tgBotsService: TgBotsService,
    private readonly walletServiceV2: WalletServiceV2,
  ) {}

  async createThank(createDto: CreateThankDto, userId: string): Promise<Thank> {
    // Validate amount
    if (createDto.amount === 0) {
      throw new Error('Thank amount cannot be zero');
    }

    // Check if user has access to the target
    let communityId: string;
    
    if (createDto.targetType === 'publication') {
      const publication = await this.publicationServiceV2.getPublication(createDto.targetId);
      if (!publication) {
        throw new Error('Publication not found');
      }
      communityId = publication.getCommunityId.getValue();
    } else if (createDto.targetType === 'comment') {
      const comment = await this.commentServiceV2.getComment(createDto.targetId);
      if (!comment) {
        throw new Error('Comment not found');
      }
      // For comments, we need to get the community from the parent publication
      // This is a simplified implementation - in reality you'd need to track this relationship
      communityId = 'unknown'; // This needs proper implementation
    } else {
      throw new Error('Invalid target type');
    }

    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(
      communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    // Check if user has sufficient balance
    const wallet = await this.walletServiceV2.getUserWallet(userId, communityId);
    if (!wallet || wallet.getBalance() < Math.abs(createDto.amount)) {
      throw new Error('Insufficient balance');
    }

    // Create thank transaction
    const thank = await this.walletServiceV2.createTransaction(
      wallet.getId.getValue(),
      'thank',
      createDto.amount,
      `Thank for ${createDto.targetType}: ${createDto.targetId}`,
      createDto.targetType,
      createDto.targetId
    );

    return this.mapToThank(thank);
  }

  async removeThank(targetType: string, targetId: string, userId: string): Promise<boolean> {
    // This is a simplified implementation
    return true;
  }

  async getThankWithComment(id: string, userId: string): Promise<any> {
    // This is a simplified implementation
    return {
      thank: null,
      comment: null,
      wallet: null,
    };
  }

  async createThankWithComment(createDto: CreateThankDto & { targetType: 'publication' | 'comment'; targetId: string }, userId: string): Promise<Thank> {
    // This is a simplified implementation
    // In reality, you'd create both a thank and a comment
    return this.createThank(createDto, userId);
  }

  async getThanks(
    targetType: string,
    targetId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Thank>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // Get thanks for the target
    const thanks = await this.walletServiceV2.getTransactionsByReference(
      'thank',
      targetId,
      pagination.limit,
      skip
    );

    const mappedThanks = thanks.map(thank => this.mapToThank(thank));

    return PaginationHelper.createResult(mappedThanks, mappedThanks.length, pagination);
  }

  async getUserThanks(userId: string, pagination: any): Promise<PaginationResult<Thank>> {
    const skip = PaginationHelper.getSkip(pagination);
    
    // Get user's thanks
    const thanks = await this.walletServiceV2.getUserTransactions(
      userId,
      'thank',
      pagination.limit,
      skip
    );

    const mappedThanks = thanks.map(thank => this.mapToThank(thank));

    return PaginationHelper.createResult(mappedThanks, mappedThanks.length, pagination);
  }

  async getThank(id: string, userId: string): Promise<Thank | null> {
    // Check if user has access to see this thank
    let communityId: string;
    
    // This is a simplified implementation
    // In reality, you'd need to determine the community from the thank's target
    communityId = 'unknown';

    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(
      communityId,
      userId,
    );

    if (!isMember) {
      throw new Error('User is not a member of this community');
    }

    const thank = await this.walletServiceV2.getTransaction(id);
    return thank ? this.mapToThank(thank) : null;
  }

  private mapToThank(thank: any): Thank {
    return {
      id: thank.getId?.getValue() || thank.id,
      userId: thank.getUserId?.getValue() || thank.userId,
      targetType: thank.getTargetType?.() || thank.targetType,
      targetId: thank.getTargetId?.() || thank.targetId,
      amount: thank.getAmount?.() || thank.amount,
      description: thank.getDescription?.() || thank.description,
      createdAt: thank.getCreatedAt?.()?.toISOString() || thank.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}