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
import { WalletsService } from './wallets.service';
import { UserGuard } from '../../user.guard';
import { PaginationHelper } from '../../common/helpers/pagination.helper';
import { NotFoundError } from '../../common/exceptions/api.exceptions';
import { Wallet, Transaction } from '../types/domain.types';

@Controller('api/v1')
@UseGuards(UserGuard)
export class WalletsController {
  private readonly logger = new Logger(WalletsController.name);

  constructor(private readonly walletsService: WalletsService) {}

  @Get('users/:userId/wallets')
  async getUserWallets(@Param('userId') userId: string, @Req() req: any): Promise<Wallet[]> {
    // Users can only see their own wallets
    if (userId !== req.user.tgUserId) {
      throw new NotFoundError('User', userId);
    }
    return this.walletsService.getUserWallets(userId);
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
    return this.walletsService.getUserWallet(userId, communityId);
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
    const result = await this.walletsService.getUserTransactions(userId, pagination, query);
    return result;
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
    return this.walletsService.getUserQuota(userId, query.communityId);
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
    return this.walletsService.withdrawFromWallet(userId, communityId, body.amount, body.memo);
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
    return this.walletsService.transferToUser(userId, communityId, body.toUserId, body.amount, body.description);
  }

}
