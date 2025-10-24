import {
  Controller,
  Post,
  Body,
  Res,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../../users/users.service';
import { ActorsService } from '@common/abstracts/actors/actors.service';
import { TgChatsService } from '../../../tg-chats/tg-chats.service';
import { TgBotsService } from '../../../tg-bots/tg-bots.service';
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

@Controller('api/rest/telegram-auth')
export class TelegramAuthController {
  private readonly logger = new Logger(TelegramAuthController.name);

  constructor(
    private usersService: UsersService,
    private actorsService: ActorsService,
    private configService: ConfigService,
    private tgChatsService: TgChatsService,
    private tgBotsService: TgBotsService,
  ) {}

  private verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
    const { hash, ...fields } = data;

    // Create data check string
    const dataCheckString = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${fields[key]}`)
      .join('\n');

    // Create secret key from bot token
    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    // Create HMAC
    const hmac = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash matches
    const hashValid = hmac === hash;

    // Check auth_date is within 24 hours
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
        this.logger.warn('No hash found in initData');
        return { valid: false };
      }
      
      // Create data check string
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
      
      // Create secret key for Web App (different from widget)
      // Uses "WebAppData" as the constant string per Telegram documentation
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
      
      // Verify hash
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      if (calculatedHash !== hash) {
        this.logger.warn('Hash validation failed for Web App initData');
        return { valid: false };
      }
      
      // Check auth_date is within 24 hours
      const authDate = parseInt(urlParams.get('auth_date') || '0');
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - authDate >= 86400) {
        this.logger.warn('Auth date expired (older than 24 hours)');
        return { valid: false };
      }
      
      // Parse user data
      const userJson = urlParams.get('user');
      if (!userJson) {
        this.logger.warn('No user data found in initData');
        return { valid: false };
      }
      
      const user = JSON.parse(userJson);
      
      return { valid: true, user };
    } catch (error) {
      this.logger.error('Error verifying Telegram Web App data:', error);
      return { valid: false };
    }
  }


  /**
   * Discover which communities the user is a member of by checking against all registered communities
   */
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

    // Get updated user to count tags
    const updatedUser = await this.usersService.model.findOne({
      identities: `telegram://${telegramId}`,
    });

    return updatedUser?.tags?.length || 0;
  }

  @Post()
  async authenticate(
    @Body() authData: TelegramAuthData,
    @Res() res: any,
  ) {
    try {
      this.logger.log('Telegram auth request received', {
        userId: authData.id,
        username: authData.username,
      });

      // Get bot token from config
      const botToken = this.configService.get<string>('bot.token');
      
      if (!botToken) {
        this.logger.error('BOT_TOKEN environment variable not set!');
        throw new HttpException(
          'Bot token not configured',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Verify the Telegram auth data
      const isValid = this.verifyTelegramAuth(authData, botToken);

      if (!isValid) {
        this.logger.warn('Invalid Telegram auth data', {
          userId: authData.id,
        });
        throw new HttpException(
          'Invalid authentication data',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Find or create user
      const telegramId = authData.id.toString();
      const identity = `telegram://${telegramId}`;

      // Get existing user to compare avatar
      const existingUser = await this.usersService.model.findOne({
        identities: identity,
      });

      let avatarUrl = existingUser?.profile?.avatarUrl;

      // Try to get user's profile photo using Bot API on every login
      // This allows us to update the avatar when it changes in Telegram
      // Works if the user has posted in a group where the bot is present
      // or if their privacy settings allow the bot to see their profile photo
      this.logger.log(`Attempting to fetch/update avatar via Bot API for user ${telegramId}`);
      try {
        const newAvatarUrl = await this.tgBotsService.telegramGetChatPhotoUrl(
          botToken,
          telegramId,
          true, // revalidate - force refresh
        );
        
        if (newAvatarUrl) {
          // Add cache-busting timestamp to ensure browser fetches updated image
          const timestamp = Date.now();
          avatarUrl = `${newAvatarUrl}?t=${timestamp}`;
          this.logger.log(`Avatar fetched/updated successfully for user ${telegramId}`);
        } else {
          this.logger.log(`No avatar available via Bot API for user ${telegramId} (privacy settings or no photo)`);
          // Set to null to trigger placeholder on frontend
          // Don't keep old Telegram web auth URLs as they're not accessible
          avatarUrl = null;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch avatar via Bot API for user ${telegramId}:`, error.message);
        // On error, check if existing avatar is a working S3 URL
        const existingIsS3 = existingUser?.profile?.avatarUrl?.includes('telegram_small_avatars');
        // Only keep existing if it's our S3 URL, otherwise set to null for placeholder
        avatarUrl = existingIsS3 ? existingUser.profile.avatarUrl : null;
      }

      const displayName = [authData.first_name, authData.last_name].filter((a) => a).join(' ');
      this.logger.log(`Setting user profile.name to: "${displayName}" (from first_name="${authData.first_name}", last_name="${authData.last_name}")`);

      const user = await this.usersService.upsert(
        { identities: identity },
        {
          identities: [identity],
          'profile.name': displayName,
          'profile.firstName': authData.first_name,
          'profile.lastName': authData.last_name,
          'profile.avatarUrl': avatarUrl,
          'meta.username': authData.username, // Store Telegram username for better lookup
        },
      );

      if (!user) {
        throw new HttpException(
          'Failed to create user session',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log('User authenticated successfully', {
        userId: telegramId,
        userToken: user.token,
      });

      // Start community discovery in background (non-blocking)
      this.logger.log(`Starting background community discovery for user ${telegramId}`);
      this.discoverUserCommunities(telegramId).then(discoveredCount => {
        this.logger.log(`Background community discovery complete: ${discoveredCount} communities found`);
      }).catch(error => {
        this.logger.error(`Background community discovery failed for user ${telegramId}:`, error);
      });

      // Generate JWT with user data
      const jwtSecret = this.configService.get<string>('jwt.secret');
      const jwt = this.actorsService.signJWT(
        {
          token: user.token,
          uid: user.uid,
          telegramId,
          tags: user.tags || [],
        },
        '365d',
      );

      // Set JWT in HTTP-only cookie
      const isProduction = this.configService.get<string>('app.env') === 'production';
      res.cookie('jwt', jwt, {
        httpOnly: true,
        secure: isProduction, // Only use secure in production (HTTPS)
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        path: '/',
      });

      // Return user data
      return res.json({
        success: true,
        user: {
          tgUserId: telegramId,
          name: user.profile?.name,
          token: user.token,
          chatsIds: user.tags || [],
        },
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Authentication error', error.stack);
      throw new HttpException(
        'Authentication failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('webapp')
  async authenticateWebApp(
    @Body() body: { initData: string },
    @Res() res: any,
  ) {
    try {
      this.logger.log('Telegram Web App auth request received');
      
      const botToken = this.configService.get<string>('bot.token');
      if (!botToken) {
        this.logger.error('BOT_TOKEN environment variable not set!');
        throw new HttpException(
          'Bot token not configured',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      
      const { valid, user: webAppUser } = this.verifyTelegramWebAppData(body.initData, botToken);
      
      if (!valid || !webAppUser) {
        this.logger.warn('Invalid Telegram Web App data');
        throw new HttpException(
          'Invalid Web App authentication data',
          HttpStatus.UNAUTHORIZED,
        );
      }

      this.logger.log('Web App data validated successfully', {
        userId: webAppUser.id,
        username: webAppUser.username,
      });

      // Reuse existing user creation and session logic
      const telegramId = webAppUser.id.toString();
      const identity = `telegram://${telegramId}`;

      // Get existing user to compare avatar
      const existingUser = await this.usersService.model.findOne({
        identities: identity,
      });

      let avatarUrl = existingUser?.profile?.avatarUrl;

      // Try to get user's profile photo using Bot API
      this.logger.log(`Attempting to fetch/update avatar via Bot API for user ${telegramId}`);
      try {
        const newAvatarUrl = await this.tgBotsService.telegramGetChatPhotoUrl(
          botToken,
          telegramId,
          true, // revalidate - force refresh
        );
        
        if (newAvatarUrl) {
          const timestamp = Date.now();
          avatarUrl = `${newAvatarUrl}?t=${timestamp}`;
          this.logger.log(`Avatar fetched/updated successfully for user ${telegramId}`);
        } else {
          this.logger.log(`No avatar available via Bot API for user ${telegramId}`);
          avatarUrl = null;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch avatar via Bot API for user ${telegramId}:`, error.message);
        const existingIsS3 = existingUser?.profile?.avatarUrl?.includes('telegram_small_avatars');
        avatarUrl = existingIsS3 ? existingUser.profile.avatarUrl : null;
      }

      const displayName = [webAppUser.first_name, webAppUser.last_name].filter((a) => a).join(' ');
      this.logger.log(`Setting user profile.name to: "${displayName}"`);

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
        throw new HttpException(
          'Failed to create user session',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log('User authenticated successfully via Web App', {
        userId: telegramId,
        userToken: user.token,
      });

      // Start community discovery in background (non-blocking)
      this.logger.log(`Starting background community discovery for user ${telegramId}`);
      this.discoverUserCommunities(telegramId).then(discoveredCount => {
        this.logger.log(`Background community discovery complete: ${discoveredCount} communities found`);
      }).catch(error => {
        this.logger.error(`Background community discovery failed for user ${telegramId}:`, error);
      });

      // Generate JWT with user data
      const jwt = this.actorsService.signJWT(
        {
          token: user.token,
          uid: user.uid,
          telegramId,
          tags: user.tags || [],
        },
        '365d',
      );

      // Set JWT in HTTP-only cookie
      const isProduction = this.configService.get<string>('app.env') === 'production';
      res.cookie('jwt', jwt, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        path: '/',
      });

      // Return user data
      return res.json({
        success: true,
        user: {
          tgUserId: telegramId,
          name: user.profile?.name,
          token: user.token,
          chatsIds: user.tags || [],
        },
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Web App authentication error', error.stack);
      throw new HttpException(
        'Authentication failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('logout')
  async logout(@Res() res: any) {
    this.logger.log('User logout request');

    // Clear the JWT cookie
    res.cookie('jwt', '', {
      httpOnly: true,
      secure: this.configService.get<string>('app.env') === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
}

