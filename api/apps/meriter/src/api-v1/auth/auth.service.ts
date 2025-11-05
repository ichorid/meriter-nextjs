import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserService } from '../../domain/services/user.service';
import { CommunityService } from '../../domain/services/community.service';
import { TgBotsService } from '../../tg-bots/tg-bots.service';
import { User } from '../../../../../../libs/shared-types/dist/index';
import { signJWT } from '../../common/helpers/jwt';
import { Community, CommunityDocument } from '../../domain/models/community/community.schema';
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
    private readonly userService: UserService,
    private readonly communityService: CommunityService,
    private readonly tgBotsService: TgBotsService,
    private readonly configService: ConfigService,
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
  ) {}

  private isFakeDataMode(): boolean {
    return process.env.FAKE_DATA_MODE === 'true';
  }

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

    // Get existing user to compare avatar
    const existingUser = await this.userService.getUserByTelegramId(telegramId);

    let avatarUrl = existingUser?.avatarUrl;

    // Try to get user's profile photo using Bot API
    try {
      this.logger.log(`Fetching avatar for user ${telegramId}...`);
      const newAvatarUrl = await this.tgBotsService.telegramGetChatPhotoUrl(
        botToken,
        telegramId,
        true, // revalidate - force refresh
      );
      
      if (newAvatarUrl) {
        const timestamp = Date.now();
        avatarUrl = `${newAvatarUrl}?t=${timestamp}`;
        this.logger.log(`Avatar fetched successfully for user ${telegramId}`);
      } else {
        this.logger.log(`No avatar available for user ${telegramId}`);
        avatarUrl = null;
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch avatar via Bot API for user ${telegramId}:`, error.message);
      const existingIsS3 = existingUser?.avatarUrl?.includes('telegram_small_avatars');
      avatarUrl = existingIsS3 ? existingUser.avatarUrl : null;
    }
    
    this.logger.log(`Creating or updating user ${telegramId}...`);

    const displayName = [authData.first_name, authData.last_name].filter((a) => a).join(' ');

    const user = await this.userService.createOrUpdateUser({
      telegramId,
      username: authData.username || undefined,
      firstName: authData.first_name,
      lastName: authData.last_name,
      displayName,
      avatarUrl: avatarUrl || undefined,
    });

    if (!user) {
      throw new Error('Failed to create user session');
    }

    this.logger.log(`User ${telegramId} created/updated successfully`);

    // Start community discovery in background
    this.discoverUserCommunities(telegramId).catch(error => {
      this.logger.error(`Background community discovery failed for user ${telegramId}:`, error);
    });

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is not configured. Cannot generate JWT token.');
      throw new Error('JWT secret not configured');
    }
    
    const jwtToken = signJWT(
      {
        uid: user.id,
        telegramId,
        communityTags: user.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    this.logger.log(`JWT generated for user ${telegramId}`);

    return {
      user: this.mapUserToV1Format(user),
      hasPendingCommunities: (user.communityTags?.length || 0) > 0,
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

    const existingUser = await this.userService.getUserByTelegramId(telegramId);

    let avatarUrl = existingUser?.avatarUrl;

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
      const existingIsS3 = existingUser?.avatarUrl?.includes('telegram_small_avatars');
      avatarUrl = existingIsS3 ? existingUser.avatarUrl : null;
    }

    const displayName = [webAppUser.first_name, webAppUser.last_name].filter((a) => a).join(' ');

    const user = await this.userService.createOrUpdateUser({
      telegramId,
      username: webAppUser.username || undefined,
      firstName: webAppUser.first_name,
      lastName: webAppUser.last_name,
      displayName,
      avatarUrl: avatarUrl || undefined,
    });

    if (!user) {
      throw new Error('Failed to create user session');
    }

    // Start community discovery in background
    this.discoverUserCommunities(telegramId).catch(error => {
      this.logger.error(`Background community discovery failed for user ${telegramId}:`, error);
    });

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is not configured. Cannot generate JWT token.');
      throw new Error('JWT secret not configured');
    }
    
    const jwtToken = signJWT(
      {
        uid: user.id,
        telegramId,
        communityTags: user.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    return {
      user: this.mapUserToV1Format(user),
      hasPendingCommunities: (user.communityTags?.length || 0) > 0,
      jwt: jwtToken,
    };
  }

  async authenticateFakeUser(fakeUserId?: string): Promise<{
    user: User;
    hasPendingCommunities: boolean;
    jwt: string;
  }> {
    if (!this.isFakeDataMode()) {
      throw new Error('Fake data mode is not enabled');
    }

    // Use provided fakeUserId or generate a default one (for backward compatibility)
    const telegramId = fakeUserId || `fake_user_dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.logger.log(`Creating or updating fake user ${telegramId}...`);

    // Generate username and display name from the fake user ID
    const sessionNumber = fakeUserId ? fakeUserId.split('_').pop()?.substring(0, 6) || 'dev' : 'dev';
    const username = `fakedev_${sessionNumber}`;
    const displayName = `Fake Dev User ${sessionNumber}`;

    const user = await this.userService.createOrUpdateUser({
      telegramId,
      username,
      firstName: 'Fake',
      lastName: 'Dev',
      displayName,
      avatarUrl: undefined,
    });

    if (!user) {
      throw new Error('Failed to create fake user');
    }

    this.logger.log(`Fake user ${telegramId} created/updated successfully`);

    // Generate JWT
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is not configured. Cannot generate JWT token.');
      throw new Error('JWT secret not configured');
    }
    
    const jwtToken = signJWT(
      {
        uid: user.id,
        telegramId,
        communityTags: user.communityTags || [],
      },
      jwtSecret,
      '365d',
    );

    this.logger.log(`JWT generated for fake user ${telegramId}`);

    return {
      user: this.mapUserToV1Format(user),
      hasPendingCommunities: (user.communityTags?.length || 0) > 0,
      jwt: jwtToken,
    };
  }

  async getCurrentUser(reqUser: any): Promise<User> {
    this.logger.log(`Getting current user for reqUser:`, JSON.stringify(reqUser, null, 2));
    
    const userId = reqUser?.id;
    this.logger.log(`Looking up user with id: ${userId}`);

    if (!userId) {
      this.logger.error('No user id found in reqUser');
      throw new Error('No user id found in request user');
    }

    const user = await this.userService.getUserById(userId);

    if (!user) {
      this.logger.error(`User not found for id: ${userId}`);
      throw new Error('User not found');
    }

    this.logger.log(`User found:`, user.id);
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
    const allCommunities = await this.communityModel
      .find({ isActive: true })
      .limit(30)
      .lean();

    const membershipChecks = allCommunities.map(async (community) => {
      const chatId = community.telegramChatId;
      if (!chatId) return;

      try {
        await this.tgBotsService.updateUserChatMembership(chatId, telegramId);
      } catch (error) {
        this.logger.warn(`Failed to check membership for ${chatId}:`, error.message);
      }
    });

    await Promise.all(membershipChecks);

    const updatedUser = await this.userService.getUser(telegramId);

    return updatedUser?.communityTags?.length || 0;
  }

  private mapUserToV1Format(user: any): User {
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      profile: {
        bio: user.profile?.bio,
        location: user.profile?.location,
        website: user.profile?.website,
        isVerified: user.profile?.isVerified,
      },
      communityTags: user.communityTags || [],
      communityMemberships: user.communityMemberships || [],
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
