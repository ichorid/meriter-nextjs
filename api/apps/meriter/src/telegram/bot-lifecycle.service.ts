import { Injectable, Logger } from '@nestjs/common';
import { CommunityRepository } from '../domain/models/community/community.repository';
import { UserRepository } from '../domain/models/user/user.repository';

export interface TelegramChatInfo {
  chatId: string;
  chatUsername?: string;
  title?: string;
  description?: string;
  avatarUrl?: string;
}

export interface TelegramUserInfo {
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  avatarUrl?: string;
}

@Injectable()
export class TelegramBotLifecycleService {
  private readonly logger = new Logger(TelegramBotLifecycleService.name);

  constructor(
    private communityRepository: CommunityRepository,
    private userRepository: UserRepository,
  ) {}

  async handleBotAddedToChat(chatInfo: TelegramChatInfo): Promise<void> {
    this.logger.log(`Bot added to chat: ${chatInfo.chatId}`);

    // Check if community already exists
    const existingCommunity = await this.communityRepository.findByTelegramChatId(chatInfo.chatId);
    if (existingCommunity) {
      this.logger.log(`Community already exists for chat ${chatInfo.chatId}, reactivating`);
      await this.communityRepository.update(existingCommunity.id, {
        isActive: true,
        updatedAt: new Date(),
      });
      return;
    }

    // Create new community
    const community = await this.communityRepository.createCommunity(
      chatInfo.chatId,
      chatInfo.title || `Chat ${chatInfo.chatId}`,
      chatInfo.description
    );

    this.logger.log(`Community created: ${community.id} for chat ${chatInfo.chatId}`);
  }

  async handleBotRemovedFromChat(chatId: string): Promise<void> {
    this.logger.log(`Bot removed from chat: ${chatId}`);

    const community = await this.communityRepository.findByTelegramChatId(chatId);
    if (!community) {
      this.logger.warn(`Community not found for chat ${chatId}`);
      return;
    }

    // Mark community as inactive
    await this.communityRepository.update(community.id, {
      isActive: false,
      updatedAt: new Date(),
    });

    // Remove community tag from all users
    const users = await this.userRepository.findByCommunityTag(chatId);
    for (const user of users) {
      await this.userRepository.removeCommunityTag(user.id, chatId);
    }

    this.logger.log(`Community deactivated: ${community.id}`);
  }

  async handleUserJoinedChat(chatId: string, userInfo: TelegramUserInfo): Promise<void> {
    this.logger.log(`User joined chat: ${userInfo.userId} in ${chatId}`);

    // Find or create user
    let user = await this.userRepository.findByTelegramId(userInfo.userId);
    if (!user) {
      user = await this.userRepository.createUser(
        userInfo.userId,
        userInfo.displayName,
        userInfo.username
      );
    }

    // Add community tag to user
    await this.userRepository.addCommunityTag(user.id, chatId);

    // Add user to community members
    const community = await this.communityRepository.findByTelegramChatId(chatId);
    if (community) {
      await this.communityRepository.addMember(community.id, user.id);
    }

    this.logger.log(`User ${user.id} added to community ${chatId}`);
  }

  async handleUserLeftChat(chatId: string, userId: string): Promise<void> {
    this.logger.log(`User left chat: ${userId} from ${chatId}`);

    const user = await this.userRepository.findByTelegramId(userId);
    if (!user) {
      this.logger.warn(`User not found: ${userId}`);
      return;
    }

    // Remove community tag from user
    await this.userRepository.removeCommunityTag(user.id, chatId);

    // Remove user from community members
    const community = await this.communityRepository.findByTelegramChatId(chatId);
    if (community) {
      await this.communityRepository.removeMember(community.id, user.id);
    }

    this.logger.log(`User ${user.id} removed from community ${chatId}`);
  }
}
