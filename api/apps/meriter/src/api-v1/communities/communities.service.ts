import { Injectable, Logger } from '@nestjs/common';
import { TgChatsService } from '../../tg-chats/tg-chats.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { HashtagsService } from '../../hashtags/hashtags.service';
import { ConfigService } from '@nestjs/config';
import { PaginationHelper, PaginationResult } from '../../common/helpers/pagination.helper';
import { Community, Space, UpdateCommunityDto, UpdateSpaceDto } from '../types/domain.types';

@Injectable()
export class CommunitiesService {
  private readonly logger = new Logger(CommunitiesService.name);

  constructor(
    private readonly tgChatsService: TgChatsService,
    private readonly tgBotsService: TgBotsService,
    private readonly hashtagsService: HashtagsService,
    private readonly configService: ConfigService,
  ) {}

  async getCommunities(pagination: any): Promise<PaginationResult<Community>> {
    const skip = PaginationHelper.getSkip(pagination);
    const communities = await this.tgChatsService.model
      .find({ domainName: 'tg-chat' })
      .skip(skip)
      .limit(pagination.limit)
      .lean();

    const total = await this.tgChatsService.model.countDocuments({ domainName: 'tg-chat' });

    const mappedCommunities = communities.map(community => this.mapToCommunity(community));

    return PaginationHelper.createResult(mappedCommunities, total, pagination);
  }

  async getCommunity(id: string, userId: string): Promise<Community | null> {
    const community = await this.tgChatsService.model.findOne({
      identities: `telegram://${id}`,
      domainName: 'tg-chat',
    });

    if (!community) {
      return null;
    }

    // Check if user is member
    const isMember = await this.tgBotsService.updateUserChatMembership(id, userId);
    if (!isMember) {
      return null;
    }

    return this.mapToCommunity(community);
  }

  async createCommunity(createDto: any, userId: string): Promise<Community> {
    // Implementation for creating a new community
    // This would typically involve creating a new Telegram chat and registering it
    throw new Error('Community creation not implemented yet');
  }

  async updateCommunity(id: string, updateDto: UpdateCommunityDto): Promise<Community> {
    const updateData: any = {};

    if (updateDto.name !== undefined) {
      updateData['profile.name'] = updateDto.name;
    }
    if (updateDto.description !== undefined) {
      updateData['profile.description'] = updateDto.description;
    }
    if (updateDto.settings?.iconUrl !== undefined) {
      updateData['meta.iconUrl'] = updateDto.settings.iconUrl;
    }
    if (updateDto.settings?.currencyNames) {
      updateData['meta.currencyNames'] = updateDto.settings.currencyNames;
    }
    if (updateDto.settings?.dailyEmission !== undefined) {
      updateData['meta.dailyEmission'] = updateDto.settings.dailyEmission;
    }

    // Refresh chat avatar when admin saves settings
    let chatAvatarUrl = null;
    try {
      this.logger.log(`🖼️  Refreshing avatar for chat ${id} during settings save`);
      const botToken = this.configService.get<string>('bot.token');
      const avatarUrl = await this.tgBotsService.telegramGetChatPhotoUrl(
        botToken,
        id,
        true, // revalidate - force refresh
      );
      
      if (avatarUrl) {
        const timestamp = Date.now();
        chatAvatarUrl = `${avatarUrl}?t=${timestamp}`;
        this.logger.log(`✅ Chat avatar refreshed: ${chatAvatarUrl}`);
      } else {
        this.logger.log(`ℹ️  No avatar available for chat ${id}`);
      }
    } catch (error) {
      this.logger.warn(`⚠️  Failed to refresh chat avatar for ${id}:`, error.message);
    }

    if (chatAvatarUrl) {
      updateData['profile.avatarUrl'] = chatAvatarUrl;
    }

    const updateResult = await this.tgChatsService.model.updateOne(
      { identities: `telegram://${id}` },
      updateData,
    );

    if (updateResult.modifiedCount === 0) {
      throw new Error('Community not found or no changes made');
    }

    const updatedCommunity = await this.tgChatsService.model.findOne({
      identities: `telegram://${id}`,
    });

    return this.mapToCommunity(updatedCommunity);
  }

  async deleteCommunity(id: string): Promise<void> {
    const result = await this.tgChatsService.model.deleteOne({
      identities: `telegram://${id}`,
    });

    if (result.deletedCount === 0) {
      throw new Error('Community not found');
    }
  }

  async getCommunityMembers(id: string, pagination: any): Promise<PaginationResult<any>> {
    // Implementation for getting community members
    // This would involve getting the list of Telegram chat members
    throw new Error('Community members not implemented yet');
  }

  async getCommunitySpaces(id: string): Promise<Space[]> {
    const hashtags = await this.hashtagsService.getInChat(id);
    return hashtags.map(hashtag => this.mapToSpace(hashtag));
  }

  async createSpace(communityId: string, createDto: any): Promise<Space> {
    const spaceData = {
      uid: createDto.slug,
      profile: {
        name: createDto.name,
        description: createDto.description,
      },
      slug: createDto.slug,
      meta: {
        parentTgChatId: communityId,
        isDeleted: false,
        dailyEmission: 10,
      },
    };

    await this.hashtagsService.upsertList(communityId, [spaceData]);

    const createdSpace = await this.hashtagsService.model.findOne({
      slug: createDto.slug,
      'meta.parentTgChatId': communityId,
    });

    return this.mapToSpace(createdSpace);
  }

  async updateSpace(spaceId: string, updateDto: UpdateSpaceDto): Promise<Space> {
    const updateData: any = {};

    if (updateDto.name !== undefined) {
      updateData['profile.name'] = updateDto.name;
    }
    if (updateDto.description !== undefined) {
      updateData['profile.description'] = updateDto.description;
    }
    if (updateDto.isActive !== undefined) {
      updateData['meta.isDeleted'] = !updateDto.isActive;
    }

    const result = await this.hashtagsService.model.updateOne(
      { uid: spaceId },
      updateData,
    );

    if (result.modifiedCount === 0) {
      throw new Error('Space not found');
    }

    const updatedSpace = await this.hashtagsService.model.findOne({ uid: spaceId });
    return this.mapToSpace(updatedSpace);
  }

  async deleteSpace(spaceId: string): Promise<void> {
    const result = await this.hashtagsService.model.updateOne(
      { uid: spaceId },
      { 'meta.isDeleted': true },
    );

    if (result.modifiedCount === 0) {
      throw new Error('Space not found');
    }
  }

  async isUserAdmin(communityId: string, userId: string): Promise<boolean> {
    const community = await this.tgChatsService.model.findOne({
      identities: `telegram://${communityId}`,
    });

    if (!community) {
      return false;
    }

    const administratorsIds = (community.administrators || []).map(a => a.replace('telegram://', ''));
    return administratorsIds.includes(userId);
  }

  async syncUserCommunities(userId: string): Promise<{ syncedCount: number }> {
    // Implementation for syncing user's communities from Telegram
    // This would typically involve:
    // 1. Getting user's chat list from Telegram
    // 2. Updating local database with new/updated communities
    // 3. Returning count of synced communities
    
    // For now, return a mock implementation
    this.logger.log(`Syncing communities for user ${userId}`);
    
    // In a real implementation, this would:
    // - Call Telegram API to get user's chats
    // - Update local database
    // - Return actual count
    
    return { syncedCount: 0 };
  }

  private mapToCommunity(community: any): Community & any {
    const chatId = community.identities?.[0]?.replace('telegram://', '');
    const administratorsIds = (community.administrators || []).map(a => a.replace('telegram://', ''));

    return {
      id: chatId,
      telegramChatId: chatId,
      name: community.profile?.name || 'Unknown Community',
      description: community.profile?.description,
      avatarUrl: community.profile?.avatarUrl,
      administrators: administratorsIds,
      members: [], // Would need to fetch from Telegram API
      settings: {
        iconUrl: community.meta?.iconUrl,
        currencyNames: community.meta?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: community.meta?.dailyEmission || 10,
      },
      spaces: [], // Will be populated separately
      createdAt: community.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: community.updatedAt?.toISOString() || new Date().toISOString(),
      // Additional fields for frontend compatibility
      icon: community.meta?.iconUrl,
      username: community.profile?.username,
      title: community.profile?.name,
      chat: {
        photo: community.profile?.avatarUrl,
        title: community.profile?.name,
        username: community.profile?.username,
        url: community.profile?.username ? `https://t.me/${community.profile.username}` : undefined,
        tags: community.meta?.tags || [],
        administratorsIds,
      },
      hashtags: community.meta?.tags || [],
    };
  }

  private mapToSpace(hashtag: any): Space {
    return {
      id: hashtag.uid,
      communityId: hashtag.meta?.parentTgChatId,
      slug: hashtag.slug,
      name: hashtag.profile?.name || hashtag.slug,
      description: hashtag.profile?.description,
      isActive: !hashtag.meta?.isDeleted,
      createdAt: hashtag.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: hashtag.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
