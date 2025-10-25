import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserGuard } from '../../user.guard';
import { ApiError, UnauthorizedError, InternalServerError } from '../../common/exceptions/api.exceptions';
import { User } from '../types/domain.types';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramWebAppData {
  initData: string;
}

@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('telegram/widget')
  async authenticateWidget(
    @Body() authData: TelegramAuthData,
    @Res() res: any,
  ) {
    try {
      this.logger.log('Telegram widget auth request received', {
        userId: authData.id,
        username: authData.username,
      });

      const result = await this.authService.authenticateTelegramWidget(authData);
      
      // Set JWT cookie
      res.cookie('jwt', result.jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        path: '/',
      });

      return {
        success: true,
        data: {
          user: result.user,
          hasPendingCommunities: result.hasPendingCommunities,
        },
      };
    } catch (error) {
      this.logger.error('Widget authentication error', error.stack);
      throw new UnauthorizedError('Authentication failed');
    }
  }

  @Post('telegram/webapp')
  async authenticateWebApp(
    @Body() body: TelegramWebAppData,
    @Res() res: any,
  ) {
    try {
      this.logger.log('Telegram Web App auth request received');

      const result = await this.authService.authenticateTelegramWebApp(body.initData);
      
      // Set JWT cookie
      res.cookie('jwt', result.jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        path: '/',
      });

      return {
        success: true,
        data: {
          user: result.user,
          hasPendingCommunities: result.hasPendingCommunities,
        },
      };
    } catch (error) {
      this.logger.error('Web App authentication error', error.stack);
      throw new UnauthorizedError('Authentication failed');
    }
  }

  @Post('logout')
  async logout(@Res() res: any) {
    this.logger.log('User logout request');

    // Clear the JWT cookie
    res.cookie('jwt', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return {
      success: true,
      data: { message: 'Logged out successfully' },
    };
  }

  @Get('me')
  @UseGuards(UserGuard)
  async getCurrentUser(@Res() req: any): Promise<User> {
    try {
      const user = await this.authService.getCurrentUser(req.user);
      return user;
    } catch (error) {
      this.logger.error('Get current user error', error.stack);
      throw new InternalServerError('Failed to get user information');
    }
  }
}
