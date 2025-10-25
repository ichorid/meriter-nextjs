import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { WalletsService } from '../../../wallets/wallets.service';
import { UserGuard } from '../../../user.guard';
import { successResponse } from '../utils/response.helper';


@Controller('api/rest/wallet')
@UseGuards(UserGuard)
export class RestWalletController {
  constructor(private walletsService: WalletsService) {}
  @Get('')
  async rest_wallet(
    @Query('tgChatId') tgChatId: string,
    @Query('comm') comm: string,
    @Req() req,
  ) {
    if (tgChatId) {
      // getValue uses objectSpreadMeta which adds 'meta.' prefix, so don't include it here
      const walletQuery = {
        currencyOfCommunityTgChatId: tgChatId,
        telegramUserId: req.user.tgUserId,
        domainName: 'wallet',  // Ensure we're querying the wallet counter, not daily balance
      };
      
      // Use getValue to get the actual wallet balance (with domainName filter)
      const balance = await this.walletsService.getValue(walletQuery);
      
      return successResponse(balance);
    } else {
      const wallets = await this.walletsService.model.find({
        'meta.telegramUserId': req.user.tgUserId,
      });

      return successResponse(wallets);
    }

    //return new RestWalletResponse();
  }
}
