import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserServiceV2 } from '../../domain/services/user.service-v2';
import { CommunityServiceV2 } from '../../domain/services/community.service-v2';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { User } from '../types/domain.types';
import { signJWT } from '../../common/helpers/jwt';
import * as crypto from 'crypto';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserServiceV2,
    private readonly communityService: CommunityServiceV2,
    private readonly tgBotsService: TgBotsService,
    private readonly configService: ConfigService,
  ) {}

  async authenticateTelegramWidget(authData: TelegramAuthData): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    jwt: string;
  }> {
    const botToken = this.configService.get<string>('bot.token');
    
    if (!botToken) {
      throw new Error('Bot token not configured');
    }

    // Verify the Telegram auth data
    const isValid = this.verifyTelegramAuth(authData, botToken);
    if (!isValid) {
      throw new Error('Invalid authentication data');
    }

    // Find or create user
    const telegramId = authData.id.toString();
    const identity = `telegram://${telegramId}`;

    // Get existing user to compare avatar
    const existingUser = await this.usersService.model.findOne({
      identities: identity,
    });

    let avatarUrl = existingUser?.profile?.avatarUrl;

    // Try to get user's profile photo using Bot API
    try {
      const newAvatarUrl = await this.tgBotsService.telegramGetChatPhotoUrl(
        botToken,
        telegramId,
        true, // revalidate - force refresh
      );
      
      if (newAvatarUrl) {
        const timestamp = Date.now();
        avatarUrl = `${newAvatarUrl}?t=${timestamp}`;
      } else {
        avatarUrl = null;
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch avatar via Bot API for user ${telegramId}:`, error.message);
      const existingIsS3 = existingUser?.profile?.avatarUrl?.includes('telegram_small_avatars');
      avatarUrl = existingIsS3 ? existingUser.profile.avatarUrl : null;
    }

    const displayName = [authData.first_name, authData.last_name].filter((a) => a).join(' ');

    const user = await this.usersService.upsert(
      { identities: identity },
      {
        identities: [identity],
        'profile.name': displayName,
        'profile.firstName': authData.first_name,
        'profile.lastName': authData.last_name,
        'profile.avatarUrl': avatarUrl,
        'meta.username': authData.username,
      },
    );

    if (!user) {
      throw new Error('Failed to create user session');
    }

    // Start community discovery in background
    this.discoverUserCommunities(telegramId).catch(error => {
      this.logger.error(`Background community discovery failed for user ${telegramId}:`, error);
    });

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret') || '';
    const jwtToken = signJWT(
      {
        token: user.token,
        uid: user.uid,
        telegramId,
        tags: user.tags || [],
      },
      jwtSecret,
      '365d',
    );

    return {
      user: this.mapUserToV1Format(user),
      hasPendingCommunities: (user.tags?.length || 0) > 0,
      jwt: jwtToken,
    };
  }

  async authenticateTelegramWebApp(initData: string): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    jwt: string;
  }> {
    const botToken = this.configService.get<string>('bot.token');
    
    if (!botToken) {
      throw new Error('Bot token not configured');
    }

    const { valid, user: webAppUser } = this.verifyTelegramWebAppData(initData, botToken);
    
    if (!valid || !webAppUser) {
      throw new Error('Invalid Web App authentication data');
    }

    // Reuse existing user creation logic
    const telegramId = webAppUser.id.toString();
    const identity = `telegram://${telegramId}`;

    const existingUser = await this.usersService.model.findOne({
      identities: identity,
    });

    let avatarUrl = existingUser?.profile?.avatarUrl;

    try {
      const newAvatarUrl = await this.tgBotsService.telegramGetChatPhotoUrl(
        botToken,
        telegramId,
        true,
      );
      
      if (newAvatarUrl) {
        const timestamp = Date.now();
        avatarUrl = `${newAvatarUrl}?t=${timestamp}`;
      } else {
        avatarUrl = null;
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch avatar via Bot API for user ${telegramId}:`, error.message);
      const existingIsS3 = existingUser?.profile?.avatarUrl?.includes('telegram_small_avatars');
      avatarUrl = existingIsS3 ? existingUser.profile.avatarUrl : null;
    }

    const displayName = [webAppUser.first_name, webAppUser.last_name].filter((a) => a).join(' ');

    const user = await this.usersService.upsert(
      { identities: identity },
      {
        identities: [identity],
        'profile.name': displayName,
        'profile.firstName': webAppUser.first_name,
        'profile.lastName': webAppUser.last_name,
        'profile.avatarUrl': avatarUrl,
      },
    );

    if (!user) {
      throw new Error('Failed to create user session');
    }

    // Start community discovery in background
    this.discoverUserCommunities(telegramId).catch(error => {
      this.logger.error(`Background community discovery failed for user ${telegramId}:`, error);
    });

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret') || '';
    const jwtToken = signJWT(
      {
        token: user.token,
        uid: user.uid,
        telegramId,
        tags: user.tags || [],
      },
      jwtSecret,
      '365d',
    );

    return {
      user: this.mapUserToV1Format(user),
      hasPendingCommunities: (user.tags?.length || 0) > 0,
      jwt: jwtToken,
    };
  }

  async getCurrentUser(reqUser: any): Promise<User> {
    const user = await this.usersService.model.findOne({
      identities: `telegram://${reqUser.tgUserId}`,
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.mapUserToV1Format(user);
  }

  private verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
    const { hash, ...fields } = data;

    const dataCheckString = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${fields[key]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const hashValid = hmac === hash;
    const authDate = fields.auth_date;
    const currentTime = Math.floor(Date.now() / 1000);
    const timeValid = currentTime - authDate < 86400; // 24 hours

    return hashValid && timeValid;
  }

  private verifyTelegramWebAppData(initData: string, botToken: string): { valid: boolean; user?: any } {
    try {
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      urlParams.delete('hash');
      
      if (!hash) {
        return { valid: false };
      }
      
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
      
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      if (calculatedHash !== hash) {
        return { valid: false };
      }
      
      const authDate = parseInt(urlParams.get('auth_date') || '0');
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - authDate >= 86400) {
        return { valid: false };
      }
      
      const userJson = urlParams.get('user');
      if (!userJson) {
        return { valid: false };
      }
      
      const user = JSON.parse(userJson);
      return { valid: true, user };
    } catch (error) {
      this.logger.error('Error verifying Telegram Web App data:', error);
      return { valid: false };
    }
  }

  private async discoverUserCommunities(telegramId: string): Promise<number> {
    const allCommunities = await this.tgChatsService.model
      .find({ domainName: 'tg-chat' })
      .limit(30)
      .lean();

    const membershipChecks = allCommunities.map(async (community) => {
      const chatId = community.identities?.[0]?.replace('telegram://', '');
      if (!chatId) return;

      try {
        await this.tgBotsService.updateUserChatMembership(chatId, telegramId);
      } catch (error) {
        this.logger.warn(`Failed to check membership for ${chatId}:`, error.message);
      }
    });

    await Promise.all(membershipChecks);

    const updatedUser = await this.usersService.model.findOne({
      identities: `telegram://${telegramId}`,
    });

    return updatedUser?.tags?.length || 0;
  }

  private mapUserToV1Format(user: any): User {
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
