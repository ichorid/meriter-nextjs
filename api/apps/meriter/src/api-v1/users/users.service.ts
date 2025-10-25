import { Injectable, Logger } from '@nestjs/common';
import { UsersService as LegacyUsersService } from '../../users/users.service';
import { TgChatsService } from '../../tg-chats/tg-chats.service';
import { User } from '../types/domain.types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly legacyUsersService: LegacyUsersService,
    private readonly tgChatsService: TgChatsService,
  ) {}

  async getUser(userId: string): Promise<User | null> {
    const user = await this.legacyUsersService.model.findOne({
      identities: `telegram://${userId}`,
    });

    if (!user) {
      return null;
    }

    return this.mapToUser(user);
  }

  async getUserCommunities(userId: string): Promise<any[]> {
    const user = await this.legacyUsersService.model.findOne({
      identities: `telegram://${userId}`,
    });

    if (!user) {
      return [];
    }

    const userTags = user.tags || [];

    // Get all communities where the user is a member
    const communities = await this.tgChatsService.model.find({
      identities: { $in: userTags.map(tag => `telegram://${tag}`) },
      domainName: 'tg-chat',
    });

    return communities.map(chat => {
      const chatId = chat.identities?.[0]?.replace('telegram://', '');
      const administratorsIds = (chat.administrators || []).map(a => a.replace('telegram://', ''));
      const isAdmin = administratorsIds.includes(userId);
      const needsSetup = !chat.meta?.hashtagLabels || chat.meta.hashtagLabels.length === 0;

      return {
        id: chatId,
        telegramChatId: chatId,
        name: chat.profile?.name || 'Unknown Community',
        description: chat.profile?.description,
        avatarUrl: chat.profile?.avatarUrl,
        administrators: administratorsIds,
        members: [], // Would need to fetch from Telegram API
        settings: {
          iconUrl: chat.meta?.iconUrl,
          currencyNames: chat.meta?.currencyNames || {
            singular: 'merit',
            plural: 'merits',
            genitive: 'merits',
          },
          dailyEmission: chat.meta?.dailyEmission || 10,
        },
        spaces: [], // Will be populated separately
        isAdmin,
        needsSetup,
        createdAt: chat.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: chat.updatedAt?.toISOString() || new Date().toISOString(),
      };
    });
  }

  async getUserManagedCommunities(userId: string): Promise<any[]> {
    const chats = await this.tgChatsService.model.find({
      administrators: `telegram://${userId}`,
    });

    return chats.map(chat => ({
      id: chat.identities?.[0]?.replace('telegram://', ''),
      telegramChatId: chat.identities?.[0]?.replace('telegram://', ''),
      name: chat.profile?.name || 'Unknown Community',
      description: chat.profile?.description,
      avatarUrl: chat.profile?.avatarUrl,
      administrators: (chat.administrators || []).map(a => a.replace('telegram://', '')),
      members: [], // Would need to fetch from Telegram API
      settings: {
        iconUrl: chat.meta?.iconUrl,
        currencyNames: chat.meta?.currencyNames || {
          singular: 'merit',
          plural: 'merits',
          genitive: 'merits',
        },
        dailyEmission: chat.meta?.dailyEmission || 10,
      },
      spaces: [], // Will be populated separately
      createdAt: chat.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: chat.updatedAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getUpdatesFrequency(userId: string): Promise<{ frequency: string }> {
    // Implementation for getting user's update frequency settings
    // This would typically involve getting settings from user profile or separate settings collection
    
    // For now, return a mock implementation
    this.logger.log(`Getting updates frequency for user ${userId}`);
    
    // In a real implementation, this would:
    // - Query user settings from database
    // - Return actual frequency setting
    
    return { frequency: 'daily' }; // Default frequency
  }

  async updateUpdatesFrequency(userId: string, frequency: string): Promise<{ frequency: string }> {
    // Implementation for updating user's update frequency settings
    // This would typically involve updating settings in user profile or separate settings collection
    
    this.logger.log(`Updating updates frequency for user ${userId} to ${frequency}`);
    
    // In a real implementation, this would:
    // - Validate frequency value
    // - Update user settings in database
    // - Return updated setting
    
    return { frequency };
  }

  private mapToUser(user: any): User {
    return {
      id: user.uid,
      telegramId: user.identities?.[0]?.replace('telegram://', '') || '',
      username: user.meta?.username,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
      displayName: user.profile?.name || 'User',
      avatarUrl: user.profile?.avatarUrl,
      profile: {
        bio: user.profile?.bio,
        location: user.profile?.location,
        website: user.profile?.website,
        isVerified: user.profile?.isVerified,
      },
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
