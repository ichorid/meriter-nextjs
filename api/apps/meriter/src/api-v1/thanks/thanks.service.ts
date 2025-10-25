import { Injectable, Logger } from '@nestjs/common';
import { TransactionsService } from '../../transactions/transactions.service';
import { PublicationsService } from '../../publications/publications.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { WalletsService } from '../../wallets/wallets.service';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Thank, CreateThankDto } from '../types/domain.types';

@Injectable()
export class ThanksService {
  private readonly logger = new Logger(ThanksService.name);

  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly publicationsService: PublicationsService,
    private readonly tgBotsService: TgBotsService,
    private readonly walletsService: WalletsService,
  ) {}

  async createThank(createDto: CreateThankDto, userId: string): Promise<Thank> {
    // Validate amount
    if (createDto.amount === 0) {
      throw new Error('Thank amount cannot be zero');
    }

    // Check if user has access to the target
    let communityId: string;
    
    if (createDto.targetType === 'publication') {
      const publication = await this.publicationsService.model.findOne({
        uid: createDto.targetId,
      });
      if (!publication) {
        throw new Error('Publication not found');
      }
      communityId = publication.meta?.origin?.telegramChatId;
    } else if (createDto.targetType === 'comment') {
      const comment = await this.transactionsService.model.findOne({
        uid: createDto.targetId,
      });
      if (!comment) {
        throw new Error('Comment not found');
      }
      const publication = await this.publicationsService.model.findOne({
        uid: comment.meta?.parentPublicationUri,
      });
      if (!publication) {
        throw new Error('Publication not found');
      }
      communityId = publication.meta?.origin?.telegramChatId;
    } else {
      throw new Error('Invalid target type');
    }

    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(communityId, userId);
    if (!isMember) {
      throw new Error('Not authorized to thank in this community');
    }

    // Check if user has sufficient balance
    const walletQuery = {
      telegramUserId: userId,
      currencyOfCommunityTgChatId: communityId,
      domainName: 'wallet',
    };

    const walletValue = await this.walletsService.getValue(walletQuery);
    
    if (walletValue === null || walletValue < Math.abs(createDto.amount)) {
      throw new Error(`Insufficient balance. Available: ${walletValue ?? 0}, Required: ${Math.abs(createDto.amount)}`);
    }

    // Deduct amount from wallet
    const walletQueryForDelta = {
      telegramUserId: userId,
      currencyOfCommunityTgChatId: communityId,
    };
    await this.walletsService.delta(-Math.abs(createDto.amount), walletQueryForDelta);

    // Create thank transaction
    let transaction;
    if (createDto.targetType === 'publication') {
      transaction = await this.transactionsService.createForPublication({
        amount: createDto.amount,
        comment: `Thanked ${createDto.amount > 0 ? 'positively' : 'negatively'}`,
        forPublicationUid: createDto.targetId,
        fromUserTgId: userId,
        fromUserTgName: '', // Will be filled by service
      });
    } else {
      transaction = await this.transactionsService.createForTransaction({
        amount: createDto.amount,
        comment: `Thanked ${createDto.amount > 0 ? 'positively' : 'negatively'}`,
        forTransactionUid: createDto.targetId,
        inPublicationUid: '', // Will be filled by service
        fromUserTgId: userId,
        fromUserTgName: '', // Will be filled by service
      });
    }

    return this.mapToThank(transaction);
  }

  async getThanks(
    targetType: 'publication' | 'comment',
    targetId: string,
    pagination: any,
    userId: string,
  ): Promise<PaginationResult<Thank>> {
    const skip = PaginationHelper.getSkip(pagination);

    // Check if user has access to the target
    let communityId: string;
    
    if (targetType === 'publication') {
      const publication = await this.publicationsService.model.findOne({
        uid: targetId,
      });
      if (!publication) {
        throw new Error('Publication not found');
      }
      communityId = publication.meta?.origin?.telegramChatId;
    } else {
      const comment = await this.transactionsService.model.findOne({
        uid: targetId,
      });
      if (!comment) {
        throw new Error('Comment not found');
      }
      const publication = await this.publicationsService.model.findOne({
        uid: comment.meta?.parentPublicationUri,
      });
      if (!publication) {
        throw new Error('Publication not found');
      }
      communityId = publication.meta?.origin?.telegramChatId;
    }

    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(communityId, userId);
    if (!isMember) {
      throw new Error('Not authorized to see thanks in this community');
    }

    // Get thanks
    const query: any = {};
    if (targetType === 'publication') {
      query['meta.parentPublicationUri'] = targetId;
    } else {
      query['meta.parentTransactionUri'] = targetId;
    }

    const thanks = await this.transactionsService.model
      .find(query)
      .skip(skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 })
      .lean();

    const total = await this.transactionsService.model.countDocuments(query);

    const mappedThanks = thanks.map(thank => this.mapToThank(thank));

    return PaginationHelper.createResult(mappedThanks, total, pagination);
  }

  async removeThank(targetType: 'publication' | 'comment', targetId: string, userId: string): Promise<void> {
    // Find existing thank
    const query: any = {
      'meta.from.telegramUserId': userId,
    };

    if (targetType === 'publication') {
      query['meta.parentPublicationUri'] = targetId;
    } else {
      query['meta.parentTransactionUri'] = targetId;
    }

    const existingThank = await this.transactionsService.model.findOne(query);
    if (!existingThank) {
      throw new Error('Thank not found');
    }

    // Refund the amount to wallet
    const communityId = existingThank.meta?.amounts?.currencyOfCommunityTgChatId;
    if (communityId) {
      const walletQueryForDelta = {
        telegramUserId: userId,
        currencyOfCommunityTgChatId: communityId,
      };
      await this.walletsService.delta(Math.abs(existingThank.meta?.amounts?.total || 0), walletQueryForDelta);
    }

    // Delete the thank
    await this.transactionsService.model.deleteOne({ uid: existingThank.uid });
  }

  async getThankWithComment(thankId: string, userId: string): Promise<{ thank: Thank; comment?: any }> {
    // Get the thank
    const thank = await this.transactionsService.model.findOne({ uid: thankId });
    if (!thank) {
      throw new Error('Thank not found');
    }

    // Check if user has access to see this thank
    let communityId: string;
    if (thank.meta?.parentPublicationUri) {
      const publication = await this.publicationsService.model.findOne({
        uid: thank.meta.parentPublicationUri,
      });
      if (!publication) {
        throw new Error('Publication not found');
      }
      communityId = publication.meta?.origin?.telegramChatId;
    } else if (thank.meta?.parentTransactionUri) {
      const comment = await this.transactionsService.model.findOne({
        uid: thank.meta.parentTransactionUri,
      });
      if (!comment) {
        throw new Error('Comment not found');
      }
      const publication = await this.publicationsService.model.findOne({
        uid: comment.meta?.parentPublicationUri,
      });
      if (!publication) {
        throw new Error('Publication not found');
      }
      communityId = publication.meta?.origin?.telegramChatId;
    } else {
      throw new Error('Invalid thank structure');
    }

    // Check if user is member of community
    const isMember = await this.tgBotsService.updateUserChatMembership(communityId, userId);
    if (!isMember) {
      throw new Error('Not authorized to see this thank');
    }

    // Look for associated comment (explanation comment)
    const commentQuery = {
      'meta.parentTransactionUri': thankId,
      type: 'comment',
    };
    const comment = await this.transactionsService.model.findOne(commentQuery);

    return {
      thank: this.mapToThank(thank),
      comment: comment ? this.mapToComment(comment) : undefined,
    };
  }

  private mapToComment(transaction: any): any {
    return {
      id: transaction.uid,
      targetType: transaction.meta?.parentPublicationUri ? 'publication' : 'comment',
      targetId: transaction.meta?.parentPublicationUri || transaction.meta?.parentTransactionUri || '',
      authorId: transaction.meta?.from?.telegramUserId || '',
      content: transaction.meta?.comment || '',
      metrics: {
        upthanks: 0, // Would need to calculate from thanks
        downthanks: 0,
        score: 0,
        replyCount: 0,
      },
      createdAt: transaction.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: transaction.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  private mapToThank(transaction: any): Thank {
    return {
      id: transaction.uid,
      targetType: transaction.meta?.parentPublicationUri ? 'publication' : 'comment',
      targetId: transaction.meta?.parentPublicationUri || transaction.meta?.parentTransactionUri || '',
      userId: transaction.meta?.from?.telegramUserId || '',
      amount: transaction.meta?.amounts?.total || 0,
      sourceType: transaction.meta?.amounts?.free ? 'daily_quota' : 'personal',
      createdAt: transaction.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
}
