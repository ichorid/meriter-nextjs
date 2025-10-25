import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { WalletService } from '../../domain/services/wallet.service';
import { User } from '../../decorators/user.decorator';
import { UserGuard } from '../../user.guard';

@Controller('api/v1/wallets')
@UseGuards(UserGuard)
export class WalletsController {
  constructor(
    private walletService: WalletService,
  ) {}

  @Get('user/:communityId')
  async getWallet(
    @User() user: any,
    @Param('communityId') communityId: string,
  ) {
    return this.walletService.getWallet(user.id, communityId);
  }

  @Get('user')
  async getUserWallets(
    @User() user: any,
  ) {
    return this.walletService.getUserWallets(user.id);
  }

  @Get('balance/:communityId')
  async getBalance(
    @User() user: any,
    @Param('communityId') communityId: string,
  ) {
    const balance = await this.walletService.getWalletBalance(user.id, communityId);
    return { balance };
  }

  @Post('create')
  async createWallet(
    @User() user: any,
    @Body() dto: { communityId: string },
  ) {
    return this.walletService.createWallet(user.id, dto.communityId);
  }

  @Post('add-merits')
  async addMerits(
    @User() user: any,
    @Body() dto: {
      communityId: string;
      amount: number;
      sourceType: 'personal' | 'quota';
      referenceType: string;
      referenceId: string;
      description?: string;
    },
  ) {
    return this.walletService.addMerits(
      user.id,
      dto.communityId,
      dto.amount,
      dto.sourceType,
      dto.referenceType,
      dto.referenceId,
      dto.description,
    );
  }

  @Post('deduct-merits')
  async deductMerits(
    @User() user: any,
    @Body() dto: {
      communityId: string;
      amount: number;
      sourceType: 'personal' | 'quota';
      referenceType: string;
      referenceId: string;
      description?: string;
    },
  ) {
    return this.walletService.deductMerits(
      user.id,
      dto.communityId,
      dto.amount,
      dto.sourceType,
      dto.referenceType,
      dto.referenceId,
      dto.description,
    );
  }

  @Get('transactions')
  async getTransactions(
    @User() user: any,
    @Query('communityId') communityId: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    // First get the wallet
    const wallet = await this.walletService.getWallet(user.id, communityId);
    if (!wallet) {
      return [];
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedSkip = skip ? parseInt(skip, 10) : 0;

    return this.walletService.getTransactions(wallet.id, parsedLimit, parsedSkip);
  }
}
