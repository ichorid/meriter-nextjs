import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WalletServiceV2 } from '../../domain/services/wallet.service-v2';
import { CommunityServiceV2 } from '../../domain/services/community.service-v2';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { Wallet, Transaction } from '../types/domain.types';
import { Community, CommunityDocument } from '../../domain/models/community/community.schema';

@Controller('api/v1')
@UseGuards(UserGuard)
export class WalletsController {
  private readonly logger = new Logger(WalletsController.name);

  constructor(
    private readonly walletsService: WalletServiceV2,
    private readonly communityService: CommunityServiceV2,
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
  ) {}

  @Get('users/:userId/wallets')
  async getUserWallets(@Param('userId') userId: string, @Req() req: any): Promise<Wallet[]> {
    // Users can only see their own wallets
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    
    // Get all active communities the user is a member of
    const allCommunities = await this.communityModel.find({ isActive: true }).lean();
    this.logger.log(`Found ${allCommunities.length} active communities for user ${userId}`);
    
    // Create wallets for communities where user doesn't have one yet
    const walletPromises = allCommunities.map(async (community) => {
      let wallet = await this.walletsService.getWallet(userId, community.telegramChatId);
      
      if (!wallet) {
        // Create wallet with community currency settings
        wallet = await this.walletsService.createOrGetWallet(
          userId,
          community.telegramChatId,
          community.settings?.currencyNames || { singular: 'merit', plural: 'merits', genitive: 'merits' }
        );
        this.logger.log(`Created wallet for user ${userId} in community ${community.name}`);
      }
      
      return wallet;
    });
    
    const wallets = await Promise.all(walletPromises);
    
    return wallets.map(wallet => {
      const snapshot = wallet.toSnapshot();
      return {
        ...snapshot,
        lastUpdated: snapshot.lastUpdated.toISOString(),
        createdAt: snapshot.lastUpdated.toISOString(), // Use lastUpdated as createdAt fallback
        updatedAt: snapshot.lastUpdated.toISOString(), // Use lastUpdated as updatedAt fallback
      };
    });
  }

  @Get('users/:userId/wallets/:communityId')
  async getUserWallet(
    @Param('userId') userId: string,
    @Param('communityId') communityId: string,
    @Req() req: any,
  ): Promise<Wallet> {
    // Users can only see their own wallets
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    const wallet = await this.walletsService.getUserWallet(userId, communityId);
    if (!wallet) {
      throw new NotFoundError('Wallet', `${userId}-${communityId}`);
    }
    const snapshot = wallet.toSnapshot();
    return {
      ...snapshot,
      lastUpdated: snapshot.lastUpdated.toISOString(),
      createdAt: snapshot.lastUpdated.toISOString(), // Use lastUpdated as createdAt fallback
      updatedAt: snapshot.lastUpdated.toISOString(), // Use lastUpdated as updatedAt fallback
    };
  }

  @Get('users/:userId/transactions')
  async getUserTransactions(
    @Param('userId') userId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    // Users can only see their own transactions
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const result = await this.walletsService.getUserTransactions(userId, 'all', pagination.limit, skip);
    return { data: result, total: result.length, skip, limit: pagination.limit };
  }

  @Get('users/:userId/quota')
  async getUserQuota(
    @Param('userId') userId: string,
    @Query() query: any,
    @Req() req: any,
  ) {
    // Users can only see their own quota
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    // Quota functionality not implemented in V2 service yet
    throw new Error('Quota functionality not implemented');
  }

  @Post('users/:userId/wallets/:communityId/withdraw')
  async withdrawFromWallet(
    @Param('userId') userId: string,
    @Param('communityId') communityId: string,
    @Body() body: { amount: number; memo?: string },
    @Req() req: any,
  ) {
    // Users can only withdraw from their own wallets
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    // Withdraw functionality not implemented in V2 service yet
    throw new Error('Withdraw functionality not implemented');
  }

  @Post('users/:userId/wallets/:communityId/transfer')
  async transferToUser(
    @Param('userId') userId: string,
    @Param('communityId') communityId: string,
    @Body() body: { toUserId: string; amount: number; description?: string },
    @Req() req: any,
  ) {
    // Users can only transfer from their own wallets
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    // Transfer functionality not implemented in V2 service yet
    throw new Error('Transfer functionality not implemented');
  }

}
