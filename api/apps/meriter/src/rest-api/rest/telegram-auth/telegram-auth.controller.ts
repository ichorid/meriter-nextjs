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

      const user = await this.usersService.upsert(
        { identities: identity },
        {
          identities: [identity],
          profile: {
            name: authData.username || authData.first_name,
            firstName: authData.first_name,
            lastName: authData.last_name,
            photoUrl: authData.photo_url,
          },
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
}

