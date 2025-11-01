import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserGuard } from '../../user.guard';
import { ApiError, UnauthorizedError, InternalServerError } from '../../common/exceptions/api.exceptions';
import { TelegramAuthDataSchema, TelegramWebAppDataSchema } from '../../../../../../libs/shared-types/dist/index';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';

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
  @ZodValidation(TelegramAuthDataSchema)
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
      
      // Set JWT cookie with proper domain for Caddy reverse proxy
      const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Clear any existing JWT cookie first to ensure clean state
      // This prevents issues with multiple cookies with different attributes
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        domain: cookieDomain,
      });
      
      // Set new JWT cookie
      res.cookie('jwt', result.jwt, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        path: '/',
        domain: cookieDomain,
      });

      this.logger.log('Authentication successful, sending response');

      return res.json({
        success: true,
        data: {
          user: result.user,
          hasPendingCommunities: result.hasPendingCommunities,
        },
      });
    } catch (error) {
      this.logger.error('Widget authentication error', error.stack);
      throw new UnauthorizedError('Authentication failed');
    }
  }

  @Post('telegram/webapp')
  @ZodValidation(TelegramWebAppDataSchema)
  async authenticateWebApp(
    @Body() body: TelegramWebAppData,
    @Res() res: any,
  ) {
    try {
      this.logger.log('Telegram Web App auth request received');

      const result = await this.authService.authenticateTelegramWebApp(body.initData);
      
      // Set JWT cookie with proper domain for Caddy reverse proxy
      const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Clear any existing JWT cookie first to ensure clean state
      // This prevents issues with multiple cookies with different attributes
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/',
        domain: cookieDomain,
      });
      
      // Set new JWT cookie
      res.cookie('jwt', result.jwt, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
        path: '/',
        domain: cookieDomain,
      });

      this.logger.log('Authentication successful, sending response');

      return res.json({
        success: true,
        data: {
          user: result.user,
          hasPendingCommunities: result.hasPendingCommunities,
        },
      });
    } catch (error) {
      this.logger.error('Web App authentication error', error.stack);
      throw new UnauthorizedError('Authentication failed');
    }
  }

  @Post('logout')
  async logout(@Res() res: any) {
    this.logger.log('User logout request');

    // Clear the JWT cookie by setting it to empty and expiring it immediately
    // Must use the same options as when setting the cookie
    const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
    const isProduction = process.env.NODE_ENV === 'production';
    
    const sameSiteValue: 'none' | 'lax' = isProduction ? 'none' : 'lax';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: sameSiteValue,
      path: '/',
      domain: cookieDomain,
    };

    // Set cookie to expire immediately
    res.cookie('jwt', '', {
      ...cookieOptions,
      expires: new Date(0),
      maxAge: 0,
    });

    // Also explicitly clear it
    res.clearCookie('jwt', cookieOptions);

    return res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }

  @Get('me')
  @UseGuards(UserGuard)
  async getCurrentUser(@Res() res: any, @Req() req: any) {
    try {
      const user = await this.authService.getCurrentUser(req.user);
      res.json({ success: true, data: user });
    } catch (error) {
      this.logger.error('Get current user error', error.stack);
      throw new InternalServerError('Failed to get user information');
    }
  }
}
