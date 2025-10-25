import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { UserGuard } from '../../../user.guard';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { successResponse, ApiResponse } from '../utils/response.helper';
class RestGMCDto {
  chats: any[];
}

@Controller('api/rest/getmanagedchats')
export class RestGetmanagedchatsController {
  constructor(
    private readonly tgChatsService: TgChatsService,
    private readonly tgBotsService: TgBotsService,
  ) {}
  @UseGuards(UserGuard)
  @Get()
  async rest_getmanagedchats(
    @Req() req,
    @Query('refreshChatId') refreshChatId?: string,
  ): Promise<ApiResponse<RestGMCDto>> {
    if (refreshChatId) {
      const adms = await this.tgBotsService.tgChatGetAdmins({
        tgChatId: refreshChatId,
      });
    }
    const chats = await this.tgChatsService.model.find({
      administrators: 'telegram://' + req.user.tgUserId,
    });
    return successResponse({ 
      chats: chats.map(chat => ({
        ...chat.toObject(),
        chatId: chat.identities?.[0]?.replace('telegram://', ''),
        administratorsIds: (chat.administrators || []).map(a => a.replace('telegram://', '')),
      }))
    });
  }
}
