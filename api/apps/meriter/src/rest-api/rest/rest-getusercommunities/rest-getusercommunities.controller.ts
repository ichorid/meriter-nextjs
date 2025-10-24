import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { UserGuard } from '../../../user.guard';

class RestGUCDto {
  communities: {
    _id: string;
    photo: string;
    title: string;
    description: string;
    icon: string;
    chatId: string;
    tags: string[];
    url: string;
    helpUrl: string;
    administratorsIds: string[];
    name: string;
    type: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    isAdmin: boolean;
    needsSetup: boolean;
  }[];
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
          _id: chat.uid,
          photo: chat.profile?.avatarUrl,
          title: chat.profile?.name,
          description: chat.profile?.description,
          icon: chat.meta?.iconUrl,
          chatId,
          tags: chat.meta?.hashtagLabels || [],
          url: chat.meta?.url,
          helpUrl: chat.meta?.helpUrl,
          administratorsIds,
          name: chat.profile?.name,
          type: 'group',
          username: chat.meta?.tgUsername,
          first_name: null,
          last_name: null,
          isAdmin,
          needsSetup,
        };
      })
    };
  }
}
