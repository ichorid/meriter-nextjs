import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { UserGuard } from '../../../user.guard';

class RestCheckAdminResponse {
  isAdmin: boolean;
}

@Controller('api/rest/check-admin')
@UseGuards(UserGuard)
export class CheckAdminController {
  constructor(
    private readonly tgBotsService: TgBotsService,
  ) {}

  @Get()
  async checkAdmin(
    @Query('chatId') chatId: string,
    @Req() req,
  ): Promise<RestCheckAdminResponse> {
    const tgUserId = req.user.tgUserId;
    
    if (!chatId) {
      return { isAdmin: false };
    }

    const isAdmin = await this.tgBotsService.tgChatIsAdmin({
      tgChatId: chatId,
      tgUserId: tgUserId,
    });

    return { isAdmin };
  }
}
