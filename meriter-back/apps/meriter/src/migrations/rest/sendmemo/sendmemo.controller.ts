import {Controller, Get, Post, Query, Req, UseGuards} from '@nestjs/common';
import { UserGuard } from '../../../user.guard';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';

@Controller('api/rest/sendmemo')
@UseGuards(UserGuard)
export class SendmemoController {
  constructor(private tgBotsService: TgBotsService) {}
  @Post()
  async rest_transactions(
    @Query('self') self: string,
    @Query('chatId') chatId: string,
    @Req() req,
  ) {
    return this.tgBotsService.sendInfoLetter(
      chatId,
      self == 'true' ? req.user.tgUserId : chatId,
    );
  }
}
