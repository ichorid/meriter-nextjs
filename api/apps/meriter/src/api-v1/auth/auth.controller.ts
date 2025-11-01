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

  /**
   * Get cookie domain from DOMAIN environment variable
   * Returns undefined for localhost (no domain restriction needed)
   * Falls back to APP_URL extraction for backward compatibility if DOMAIN is not set
   */
  private getCookieDomain(): string | undefined {
    const domain = process.env.DOMAIN;
    
    if (domain) {
      // localhost doesn't need domain restriction
      return domain === 'localhost' ? undefined : domain;
    }
    
    // Backward compatibility: if APP_URL exists but DOMAIN doesn't, extract domain from APP_URL
    if (process.env.APP_URL) {
      try {
        const url = new URL(process.env.APP_URL);
        const hostname = url.hostname.split(':')[0]; // Remove port if present
        return hostname === 'localhost' ? undefined : hostname;
      } catch (error) {
        // If APP_URL is not a valid URL, return undefined
        return undefined;
      }
    }
    
    return undefined;
  }

  /**
   * Clear JWT cookie with multiple attribute combinations to ensure all variants are removed
   */
  private clearAllJwtCookieVariants(res: any, cookieDomain: string | undefined, isProduction: boolean): void {
    const baseOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
    
    // Derive all possible domain variants from cookie domain
    const domainsToTry: (string | undefined)[] = [undefined]; // Always try no domain
    
    if (cookieDomain) {
      domainsToTry.push(cookieDomain);
      
      // Add variant with leading dot if it doesn't have one
      if (!cookieDomain.startsWith('.')) {
        domainsToTry.push(`.${cookieDomain}`);
      }
      
      // Add variant without leading dot if it has one
      if (cookieDomain.startsWith('.')) {
        domainsToTry.push(cookieDomain.substring(1));
      }
    }
    
    // Remove duplicates while preserving undefined
    const uniqueDomains = Array.from(new Set(domainsToTry.map(d => d ?? 'undefined'))).map(d => d === 'undefined' ? undefined : d);
    
    for (const domain of uniqueDomains) {
      try {
        // Method 1: clearCookie
        res.clearCookie('jwt', {
          ...baseOptions,
          domain,
        });
        
        // Method 2: Set cookie to empty with immediate expiry (more reliable)
        res.cookie('jwt', '', {
          ...baseOptions,
          domain,
          expires: new Date(0),
          maxAge: 0,
        });
      } catch (error) {
        // Ignore errors when clearing - some combinations may fail
      }
    }
    
    // Also try without httpOnly in case there's a non-httpOnly cookie (shouldn't happen, but be safe)
    try {
      res.clearCookie('jwt', {
        secure: isProduction,
        sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
        path: '/',
        domain: cookieDomain,
      });
      res.cookie('jwt', '', {
        secure: isProduction,
        sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
        path: '/',
        domain: cookieDomain,
        expires: new Date(0),
        maxAge: 0,
      });
    } catch (error) {
      // Ignore errors
    }
  }

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
      const cookieDomain = this.getCookieDomain();
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Clear any existing JWT cookie first to ensure clean state
      // Try multiple attribute combinations to clear all possible cookie variants
      this.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      
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
      const cookieDomain = this.getCookieDomain();
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Clear any existing JWT cookie first to ensure clean state
      // Try multiple attribute combinations to clear all possible cookie variants
      this.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      
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
    const cookieDomain = this.getCookieDomain();
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

  @Post('clear-cookies')
  async clearCookies(@Res() res: any) {
    this.logger.debug('Cookie clearing request received');
    
    // Clear all possible JWT cookie variants
    // This is useful for clearing old cookies with mismatched attributes
    // before authentication attempts
    const cookieDomain = this.getCookieDomain();
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
    
    return res.json({
      success: true,
      data: { message: 'Cookies cleared successfully' },
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
