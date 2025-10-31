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
  BadRequestException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { WalletService } from '../../domain/services/wallet.service';
import { CommunityService } from '../../domain/services/community.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { Wallet, Transaction, WithdrawDto, TransferDto, WithdrawDtoSchema, TransferDtoSchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { Community, CommunityDocument } from '../../domain/models/community/community.schema';

@Controller('api/v1')
@UseGuards(UserGuard)
export class WalletsController {
  private readonly logger = new Logger(WalletsController.name);

  constructor(
    private readonly walletsService: WalletService,
    private readonly communityService: CommunityService,
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
    @InjectConnection() private mongoose: Connection,
  ) {}

  @Get('users/:userId/wallets')
  async getUserWallets(@Param('userId') userId: string, @Req() req: any): Promise<Wallet[]> {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only see their own wallets
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    
    // Get all active communities the user is a member of
    const allCommunities = await this.communityModel.find({ isActive: true }).lean();
    this.logger.log(`Found ${allCommunities.length} active communities for user ${actualUserId}`);
    
    // Create wallets for communities where user doesn't have one yet
    const walletPromises = allCommunities.map(async (community) => {
      let wallet = await this.walletsService.getWallet(actualUserId, community.id);
      
      if (!wallet) {
        // Create wallet with community currency settings
        wallet = await this.walletsService.createOrGetWallet(
          actualUserId,
          community.id,
          community.settings?.currencyNames || { singular: 'merit', plural: 'merits', genitive: 'merits' }
        );
        this.logger.log(`Created wallet for user ${actualUserId} in community ${community.name}`);
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
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only see their own wallets
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    const wallet = await this.walletsService.getUserWallet(actualUserId, communityId);
    if (!wallet) {
      throw new NotFoundError('Wallet', `${actualUserId}-${communityId}`);
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
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only see their own transactions
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    const pagination = PaginationHelper.parseOptions(query);
    const skip = PaginationHelper.getSkip(pagination);
    const result = await this.walletsService.getUserTransactions(actualUserId, 'all', pagination.limit, skip);
    return { data: result, total: result.length, skip, limit: pagination.limit };
  }

  @Get('users/:userId/quota')
  async getUserQuota(
    @Param('userId') userId: string,
    @Query('communityId') communityId: string,
    @Req() req: any,
  ) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only see their own quota
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    
    if (!communityId) {
      throw new BadRequestException('communityId is required');
    }

    // Query community by internal ID
    const community = await this.communityModel.findOne({ id: communityId }).lean();
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    // Hard check that settings exist and dailyEmission is configured
    if (!community.settings) {
      this.logger.warn(`Community ${communityId} missing settings`);
      throw new BadRequestException('Community settings are not configured. Please complete community setup.');
    }

    if (typeof community.settings.dailyEmission !== 'number' || community.settings.dailyEmission == null) {
      this.logger.warn(`Community ${communityId} missing dailyEmission:`, community.settings.dailyEmission);
      throw new BadRequestException('Daily emission quota is not configured. Please complete community setup.');
    }

    const dailyQuota = community.settings.dailyEmission;

    // Determine the start time for quota calculation
    // Use lastQuotaResetAt if set, otherwise use start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const quotaStartTime = community.lastQuotaResetAt 
      ? new Date(community.lastQuotaResetAt)
      : today;

    // Query votes with sourceType='quota' for this user in this community created after quotaStartTime
    // Use absolute value of amount - both upvotes and downvotes consume quota
    const usedToday = await this.mongoose.db
      .collection('votes')
      .aggregate([
        {
          $match: {
            userId: actualUserId,
            communityId: community.id,
            sourceType: 'quota',
            createdAt: { $gte: quotaStartTime }
          }
        },
        {
          $project: {
            absAmount: { $abs: '$amount' }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$absAmount' }
          }
        }
      ])
      .toArray();

    const used = usedToday.length > 0 ? usedToday[0].total : 0;

    // Calculate resetAt as next midnight or next reset time if reset was done today
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const resetAt = community.lastQuotaResetAt && community.lastQuotaResetAt >= today
      ? new Date(community.lastQuotaResetAt.getTime() + 24 * 60 * 60 * 1000) // 24 hours after reset
      : tomorrow;

    return {
      dailyQuota,
      usedToday: used,
      remainingToday: Math.max(0, dailyQuota - used),
      resetAt: resetAt.toISOString()
    };
  }

  @Post('users/:userId/wallets/:communityId/withdraw')
  @ZodValidation(WithdrawDtoSchema)
  async withdrawFromWallet(
    @Param('userId') userId: string,
    @Param('communityId') communityId: string,
    @Body() body: WithdrawDto,
    @Req() req: any,
  ) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only withdraw from their own wallets
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    // Withdraw functionality not implemented yet
    throw new Error('Withdraw functionality not implemented');
  }

  @Post('users/:userId/wallets/:communityId/transfer')
  @ZodValidation(TransferDtoSchema)
  async transferToUser(
    @Param('userId') userId: string,
    @Param('communityId') communityId: string,
    @Body() body: TransferDto,
    @Req() req: any,
  ) {
    // Handle 'me' token for current user
    const actualUserId = userId === 'me' ? req.user.id : userId;
    
    // Users can only transfer from their own wallets
    if (actualUserId !== req.user.id) {
      throw new NotFoundError('User', userId);
    }
    // Transfer functionality not implemented yet
    throw new Error('Transfer functionality not implemented');
  }

}
