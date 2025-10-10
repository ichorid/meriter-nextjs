import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { HashtagsService } from '../../../hashtags/hashtags.service';
import { TgChat } from '../../../tg-chats/model/tg-chat.model';
import { UserGuard } from '../../../user.guard';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';

// Helper functions to map between formats for API backward compatibility
function mapTgChatToOldFormat(chat: any) {
  if (!chat) return null;
  return {
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
    first_name: null,
    last_name: null,
    name: chat.profile?.name,
    type: 'group',
    username: chat.meta?.tgUsername,
  };
}

function mapHashtagToOldFormat(hashtag: any) {
  if (!hashtag) return null;
  return {
    chatId: hashtag.meta?.parentTgChatId,
    name: hashtag.profile?.name,
    tagRus: hashtag.profile?.name,
    slug: hashtag.slug,
    description: hashtag.profile?.description,
    rating: 0,
    deleted: hashtag.deleted ?? false,
    dimensionConfig: hashtag.meta?.dimensionConfig,
  };
}

function mapOldSpaceToHashtag(oldSpace: any) {
  return {
    profile: {
      name: oldSpace.tagRus || oldSpace.name,
      description: oldSpace.description,
    },
    slug: oldSpace.slug,
    meta: {
      parentTgChatId: oldSpace.chatId,
      dimensionConfig: oldSpace.dimensionConfig,
      isDeleted: false,
      dailyEmission: 10,
    },
  };
}

class RestChatObject {
  administratorsIds: string[];

  chatId: string;
  description: string;
  first_name: string;
  icon: string;
  last_name: string;
  name: string;
  tags: string[];
  title: string;
  type: string;
  username: string;
  _id: string;
}
class RestSpaceObject {
  chatId: string;
  description: string;
  name: string;
  slug: string;
  tagRus: string;
  // _id: string;
}

class RestCommunityinfoResponse {
  chat: RestChatObject;
  currencyNames: string[];
  dailyEmission: number;
  icon: string;
  spaces: RestSpaceObject[];
  setJwt?: string;
}

class RestUpdateGMCDto {
  'spaces': {
    _id: '5ff82235c939316d833ce179';
    chatId: '-400774319';
    slug: 'bql0fbmi';
    description: '';
    name: null;
    tagRus: 'хочуделать';
  }[];

  'icon': string; //'https://symbols.production.logojoy.com/symbol/865697';
  'currencyNames': {
    '1': string; //'медалька';
    '2': string; //'медали';
    '5': string; //'медалей'
  };
}
@UseGuards(UserGuard)
@Controller('api/rest/communityinfo')
export class RestCommunityifoController {
  constructor(
    private tgChatsService: TgChatsService,
    private tgBotsService: TgBotsService,
    private hashtagsService: HashtagsService,
  ) {}
  @Get()
  async rest_communityinfo(
    @Query('chatId') chatId: string,
    @Req() req,
  ): Promise<RestCommunityinfoResponse> {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;
    const telegramCommunityChatId = chatId;

    const info = await this.tgChatsService.getInfo(chatId);
    if (!info) return null;
    const hashtags = await this.hashtagsService.getInChat(chatId);
    const spaces = hashtags
      .map((h) => h.toObject())

      .map(mapHashtagToOldFormat);

    //console.log(chatId, mapTgChatToOldFormat(info));
    if (!allowedChatsIds.includes(telegramCommunityChatId)) {
      const isMember = await this.tgBotsService.updateUserChatMembership(
        telegramCommunityChatId,
        tgUserId,
      );
      if (!isMember)
        return {
          chat: mapTgChatToOldFormat(info),
          icon: info.meta.iconUrl,
          dailyEmission: 0,
          spaces: [],
          currencyNames: info.meta.currencyNames,
        };
    }
    const resp = {
      chat: mapTgChatToOldFormat(info),
      icon: info.meta.iconUrl,
      spaces,
      dailyEmission: 10,
      currencyNames: info.meta.currencyNames,
    };
    return resp;
  }

  @Post()
  async update(@Body() dto: RestUpdateGMCDto, @Query('chatId') chatId: string) {
    if (!chatId) throw 'no chatId given';
    await this.hashtagsService.upsertList(
      chatId,
      dto.spaces.map(mapOldSpaceToHashtag),
    );

    return this.tgChatsService.model.updateOne(
      {
        identities: 'telegram://' + chatId,
      },
      {
        'meta.iconUrl': dto.icon,
        'meta.currencyNames': dto.currencyNames,
        'meta.hashtagLabels': dto.spaces.map((s) => s.tagRus.replace('#', '')),
      },
    );
  }
}
