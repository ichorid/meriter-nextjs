import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserGuard } from '../../user.guard';
import { CookieManager } from '../common/utils/cookie-manager.util';
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
      const cookieDomain = CookieManager.getCookieDomain();
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Clear any existing JWT cookie first to ensure clean state
      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      
      // Set new JWT cookie
      CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);

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
      const cookieDomain = CookieManager.getCookieDomain();
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Clear any existing JWT cookie first to ensure clean state
      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      
      // Set new JWT cookie
      CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);

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

    // Clear the JWT cookie
    const cookieDomain = CookieManager.getCookieDomain();
    const isProduction = process.env.NODE_ENV === 'production';
    CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);

    return res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }

  @Post('clear-cookies')
  async clearCookies(@Res() res: any) {
    this.logger.debug('Cookie clearing request received');
    
    // Clear all possible JWT cookie variants
    // This is useful for clearing old cookies with mismatched attributes
    // before authentication attempts
    const cookieDomain = CookieManager.getCookieDomain();
    const isProduction = process.env.NODE_ENV === 'production';
    CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
    
    return res.json({
      success: true,
      data: { message: 'Cookies cleared successfully' },
    });
  }

  @Post('fake')
  async authenticateFake(@Req() req: any, @Res() res: any) {
    try {
      // Check if fake data mode is enabled
      if (process.env.FAKE_DATA_MODE !== 'true') {
        throw new ForbiddenException('Fake data mode is not enabled');
      }

      this.logger.log('Fake authentication request received');

      // Get or generate a session-specific fake user ID
      // Check for existing fake_user_id cookie (session-specific)
      let fakeUserId = req.cookies?.fake_user_id;
      
      // If no cookie exists, generate a new unique fake user ID
      if (!fakeUserId) {
        // Generate a unique ID: fake_user_<timestamp>_<random>
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        fakeUserId = `fake_user_${timestamp}_${random}`;
        this.logger.log(`Generated new fake user ID: ${fakeUserId}`);
      } else {
        this.logger.log(`Reusing existing fake user ID: ${fakeUserId}`);
      }

      const result = await this.authService.authenticateFakeUser(fakeUserId);
      
      // Set JWT cookie with proper domain for Caddy reverse proxy
      const cookieDomain = CookieManager.getCookieDomain();
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Clear any existing JWT cookie first to ensure clean state
      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      
      // Set new JWT cookie
      CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);

      // Set fake_user_id cookie (session cookie - expires when browser closes)
      res.cookie('fake_user_id', fakeUserId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        // No maxAge - this makes it a session cookie that expires when browser closes
        path: '/',
        domain: cookieDomain,
      });

      this.logger.log('Fake authentication successful, sending response');

      return res.json({
        success: true,
        data: {
          user: result.user,
          hasPendingCommunities: result.hasPendingCommunities,
        },
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error('Fake authentication error', error.stack);
      throw new UnauthorizedError('Fake authentication failed');
    }
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
