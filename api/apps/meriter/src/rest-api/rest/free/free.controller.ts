import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { WalletsService } from '../../../wallets/wallets.service';
import { UserGuard } from '../../../user.guard';
import { TransactionsService } from '../../../transactions/transactions.service';

class RestFreeResponse {
  free: number;
}
@Controller('api/rest/free')
@UseGuards(UserGuard)
export class RestFreeController {
  constructor(private transactionsService: TransactionsService) {}
  @Get()
  async rest_free(@Req() req, @Query('inSpaceSlug') inSpaceSlug: string) {
    const free = await this.transactionsService.getFreeLimit(
      req.user.tgUserId,
      inSpaceSlug,
    );
    return { free };
  }
}
