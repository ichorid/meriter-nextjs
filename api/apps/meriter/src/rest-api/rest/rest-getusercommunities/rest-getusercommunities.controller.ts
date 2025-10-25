import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { UserGuard } from '../../../user.guard';

class RestGUCDto {
  communities: any[];
}

@Controller('api/rest/getusercommunities')
export class RestGetUserCommunitiesController {
  constructor(
    private readonly tgChatsService: TgChatsService,
  ) {}

  @UseGuards(UserGuard)
  @Get()
  async rest_getusercommunities(@Req() req): Promise<RestGUCDto> {
    const tgUserId = req.user.tgUserId;
    const userTags = req.user.chatsIds || [];

    // Get all communities where the user is a member (based on user.tags)
    const communities = await this.tgChatsService.model.find({
      identities: { $in: userTags.map(tag => `telegram://${tag}`) },
      domainName: 'tg-chat',
    });

    return {
      communities: communities.map(chat => {
        const chatId = chat.identities?.[0]?.replace('telegram://', '');
        const administratorsIds = (chat.administrators || []).map(a => a.replace('telegram://', ''));
        const isAdmin = administratorsIds.includes(tgUserId);
        const needsSetup = !chat.meta?.hashtagLabels || chat.meta.hashtagLabels.length === 0;

        return {
          ...chat.toObject(),
          chatId,
          administratorsIds,
          isAdmin,
          needsSetup,
        };
      })
    };
  }
}
