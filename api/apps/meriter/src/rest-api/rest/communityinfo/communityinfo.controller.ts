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
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { HashtagsService } from '../../../hashtags/hashtags.service';
import { TgChat } from '../../../tg-chats/model/tg-chat.model';
import { UserGuard } from '../../../user.guard';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
import { successResponse, ApiResponse } from '../utils/response.helper';

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
    uid: hashtag.uid,
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
    uid: oldSpace.uid,
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
  spaces: {
    _id?: string;
    chatId?: string;
    slug: string;
    description: string;
    name?: string;
    tagRus: string;
    deleted?: boolean;
  }[];

  icon: string;
  currencyNames: {
    '1': string;
    '2': string;
    '5': string;
  };
}
@UseGuards(UserGuard)
@Controller('api/rest/communityinfo')
export class RestCommunityifoController {
  private readonly logger = new Logger(RestCommunityifoController.name);

  constructor(
    private tgChatsService: TgChatsService,
    private tgBotsService: TgBotsService,
    private hashtagsService: HashtagsService,
    private configService: ConfigService,
  ) {}
  @Get()
  async rest_communityinfo(
    @Query('chatId') chatId: string,
    @Req() req,
  ): Promise<ApiResponse<RestCommunityinfoResponse>> {
    const allowedChatsIds: string[] = req.user.chatsIds;
    const tgUserId = req.user.tgUserId;
    const telegramCommunityChatId = chatId;

    const info = await this.tgChatsService.getInfo(chatId);
    if (!info) return successResponse(null);
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
        return successResponse({
          chat: mapTgChatToOldFormat(info),
          icon: info.meta.iconUrl,
          dailyEmission: 0,
          spaces: [],
          currencyNames: info.meta.currencyNames,
        });
    }
    const resp = {
      chat: mapTgChatToOldFormat(info),
      icon: info.meta.iconUrl,
      spaces,
      dailyEmission: 10,
      currencyNames: info.meta.currencyNames,
    };
    return successResponse(resp);
  }

  @Post()
  async update(@Body() dto: any, @Query('chatId') chatId: string, @Req() req) {
    if (!chatId) throw 'no chatId given';
    
    const tgUserId = req.user.tgUserId;
    
    // Check if user is admin of this community
    const community = await this.tgChatsService.model.findOne({
      identities: 'telegram://' + chatId,
    });
    
    if (!community) {
      throw new HttpException('Community not found', HttpStatus.NOT_FOUND);
    }
    
    const administratorsIds = (community.administrators || []).map(a => a.replace('telegram://', ''));
    const isAdmin = administratorsIds.includes(tgUserId);
    
    if (!isAdmin) {
      throw new HttpException('Only administrators can update community settings', HttpStatus.FORBIDDEN);
    }
    
    const spaces = dto.spaces || [];
    
    // Add chatId to each space before mapping
    const spacesWithChatId = spaces.map(s => ({ ...s, chatId }));
    
    const hashtagLabels = spaces
      .filter((s) => s.tagRus && !s.deleted)
      .map((s) => s.tagRus.replace(/^#/, ''));
    
    await this.hashtagsService.upsertList(
      chatId,
      spacesWithChatId.map(mapOldSpaceToHashtag),
    );

    // Refresh chat avatar when admin saves settings
    let chatAvatarUrl = null;
    try {
      this.logger.log(`🖼️  Refreshing avatar for chat ${chatId} during settings save`);
      const botToken = this.configService.get<string>('bot.token');
      const avatarUrl = await this.tgBotsService.telegramGetChatPhotoUrl(
        botToken,
        chatId,
        true, // revalidate - force refresh
      );
      
      if (avatarUrl) {
        // Add cache-busting timestamp
        const timestamp = Date.now();
        chatAvatarUrl = `${avatarUrl}?t=${timestamp}`;
        this.logger.log(`✅ Chat avatar refreshed: ${chatAvatarUrl}`);
      } else {
        this.logger.log(`ℹ️  No avatar available for chat ${chatId}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️  Failed to refresh chat avatar for ${chatId}:`, error.message);
      // Non-critical - continue with settings save even if avatar refresh fails
    }

    const updateData: any = {
      'meta.iconUrl': dto.icon,
      'meta.currencyNames': dto.currencyNames,
      'meta.hashtagLabels': hashtagLabels,
    };

    // Update avatar if we successfully fetched a new one
    if (chatAvatarUrl) {
      updateData['profile.avatarUrl'] = chatAvatarUrl;
    }

    const updateResult = await this.tgChatsService.model.updateOne(
      {
        identities: 'telegram://' + chatId,
      },
      updateData,
    );
    
    return successResponse(updateResult);
  }
}
