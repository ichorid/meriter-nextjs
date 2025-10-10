import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { UserGuard } from '../../../user.guard';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
class RestGMCDto {
  'chats': {
    administratorsIds: string[]; //['123456789'];
    tags: string[];
    _id: string; //'5ff81388c939316d833cc591';
    chatId: string; //'-420747307';

    description: string; //null;
    first_name: string; //null;
    last_name: string; //null;
    name: string; //null;
    title: string; //'MERITER CORP ТЕСТИРОВАНИЕ';
    type: string; //'group';
    username: string; //null;
  }[];
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
  ): Promise<RestGMCDto> {
    if (refreshChatId) {
      const adms = await this.tgBotsService.tgChatGetAdmins({
        tgChatId: refreshChatId,
      });
    }
    const chats = await this.tgChatsService.model.find({
      administrators: 'telegram://' + req.user.tgUserId,
    });
    return { 
      chats: chats.map(chat => ({
        _id: chat.uid,
        photo: chat.profile?.avatarUrl,
        title: chat.profile?.name,
        description: chat.profile?.description,
        icon: chat.meta?.iconUrl,
        chatId: chat.identities?.[0]?.replace('telegram://', ''),
        tags: chat.meta?.hashtagLabels || [],
        url: chat.meta?.url,
        helpUrl: chat.meta?.helpUrl,
        administratorsIds: (chat.administrators || []).map(a => a.replace('telegram://', '')),
        name: chat.profile?.name,
        type: 'group',
        username: chat.meta?.tgUsername,
        first_name: null,
        last_name: null,
      }))
    };
  }
}
