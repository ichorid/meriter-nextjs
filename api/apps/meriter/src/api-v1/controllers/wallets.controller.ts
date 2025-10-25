import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { WalletServiceV2 } from '../../domain/services/wallet.service-v2';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';

@Controller('api/v1/wallets')
@UseGuards(UserGuard)
export class WalletsController {
  constructor(
    private walletService: WalletServiceV2,
  ) {}

  @Get('user/:communityId')
  async getWallet(
    @User() user: any,
    @Param('communityId') communityId: string,
  ) {
    return this.walletService.getWallet(user.id, communityId);
  }

  @Get('user')
  async getUserWallets(@User() user: any) {
    // This would need to be implemented in the service
    return { message: 'Get all user wallets - not implemented yet' };
  }

  @Get('balance/:communityId')
  async getBalance(
    @User() user: any,
    @Param('communityId') communityId: string,
  ) {
    const wallet = await this.walletService.getWallet(user.id, communityId);
    return { balance: wallet?.getBalance() || 0 };
  }

  @Post('create')
  async createWallet(
    @User() user: any,
    @Body() dto: {
      communityId: string;
      currency: { singular: string; plural: string; genitive: string };
    },
  ) {
    return this.walletService.createOrGetWallet(user.id, dto.communityId, dto.currency);
  }

  @Post('add-merits')
  async addMerits(
    @User() user: any,
    @Body() dto: {
      communityId: string;
      amount: number;
      currency: { singular: string; plural: string; genitive: string };
    },
  ) {
    return this.walletService.addTransaction(
      user.id,
      dto.communityId,
      'credit',
      dto.amount,
      'personal',
      'admin_credit',
      'admin',
      dto.currency,
      'Admin credit'
    );
  }

  @Post('deduct-merits')
  async deductMerits(
    @User() user: any,
    @Body() dto: {
      communityId: string;
      amount: number;
      currency: { singular: string; plural: string; genitive: string };
    },
  ) {
    return this.walletService.addTransaction(
      user.id,
      dto.communityId,
      'debit',
      dto.amount,
      'personal',
      'admin_debit',
      'admin',
      dto.currency,
      'Admin deduction'
    );
  }

  @Get('transactions')
  async getTransactions(
    @User() user: any,
    @Query('communityId') communityId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;

    const wallet = await this.walletService.getWallet(user.id, communityId);
    if (!wallet) {
      return [];
    }

    return this.walletService.getTransactions(wallet.getId.getValue(), parsedLimit, parsedSkip);
  }
}