import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { WalletsService } from '../../../wallets/wallets.service';
import { mapWalletToOldWallet } from '../../schemas/old-wallet.schema';
import { UserGuard } from '../../../user.guard';

class RestWalletObject {
  amount: number; //1
  currencyNames: {
    1: string; //"балл",
    2: string; //"балла"
    5: string; //"баллов",
    many: string; //"баллы"
  };
  currencyOfCommunityTgChatId: string; //"-400774319"
  tgUserId: string; //"415615274"

  _id: string; //"5ff8287bc939316d833ced30"
}

class RestWalletResponse {
  balance?: number;
  wallets?: RestWalletObject[];
}

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
      const wallet = await this.walletsService.model.findOne({
        'meta.currencyOfCommunityTgChatId': tgChatId,
        'meta.telegramUserId': req.user.tgUserId,
      });
      return { balance: wallet?.value ?? 0 };
    } else {
      const wallets = await this.walletsService.model.find({
        'meta.telegramUserId': req.user.tgUserId,
      });

      return { wallets: wallets.map(mapWalletToOldWallet) };
    }

    //return new RestWalletResponse();
  }
}
