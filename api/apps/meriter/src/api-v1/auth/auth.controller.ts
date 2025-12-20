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
import { AuthGuard } from '@nestjs/passport';
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

  constructor(private readonly authService: AuthService) { }

  // Telegram authentication endpoints removed: Telegram is fully disabled in this project.

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
  async clearCookies(@Req() req: any, @Res() res: any) {
    // Clear ALL cookies from the request, not just JWT variants
    // This prevents login loops caused by stale cookies with mismatched attributes
    const cookieDomain = CookieManager.getCookieDomain();
    const isProduction = process.env.NODE_ENV === 'production';

    // Get all cookie names from the request
    const cookieNames = new Set<string>();
    if (req.cookies) {
      Object.keys(req.cookies).forEach(name => cookieNames.add(name));
    }

    // Always ensure JWT cookie is cleared (it might be HttpOnly and not visible in req.cookies)
    cookieNames.add('jwt');

    // Also clear known cookies that might exist
    const knownCookies = ['fake_user_id', 'fake_superadmin_id', 'NEXT_LOCALE'];
    knownCookies.forEach(name => cookieNames.add(name));

    // Clear each cookie with all possible attribute combinations
    for (const cookieName of cookieNames) {
      CookieManager.clearCookieVariants(res, cookieName, cookieDomain, isProduction);
    }

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
      // Treat as production (Secure=true, SameSite=None) if explicitly production OR if accessed via HTTPS
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const isProduction = process.env.NODE_ENV === 'production' || isSecure;

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
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Fake authentication error', errorStack);
      throw new UnauthorizedError('Fake authentication failed');
    }
  }

  @Post('fake/superadmin')
  async authenticateFakeSuperadmin(@Req() req: any, @Res() res: any) {
    try {
      // Check if fake data mode is enabled
      if (process.env.FAKE_DATA_MODE !== 'true') {
        throw new ForbiddenException('Fake data mode is not enabled');
      }

      this.logger.log('Fake superadmin authentication request received');

      // Get or generate a session-specific fake superadmin user ID
      // Check for existing fake_superadmin_id cookie (session-specific)
      let fakeUserId = req.cookies?.fake_superadmin_id;

      // If no cookie exists, generate a new unique fake superadmin user ID
      if (!fakeUserId) {
        // Generate a unique ID: fake_superadmin_<timestamp>_<random>
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        fakeUserId = `fake_superadmin_${timestamp}_${random}`;
        this.logger.log(`Generated new fake superadmin user ID: ${fakeUserId}`);
      } else {
        this.logger.log(`Reusing existing fake superadmin user ID: ${fakeUserId}`);
      }

      const result = await this.authService.authenticateFakeSuperadmin(fakeUserId);

      // Set JWT cookie with proper domain for Caddy reverse proxy
      const cookieDomain = CookieManager.getCookieDomain();
      // Treat as production (Secure=true, SameSite=None) if explicitly production OR if accessed via HTTPS
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const isProduction = process.env.NODE_ENV === 'production' || isSecure;

      // Clear any existing JWT cookie first to ensure clean state
      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);

      // Set new JWT cookie
      CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);

      // Set fake_superadmin_id cookie (session cookie - expires when browser closes)
      res.cookie('fake_superadmin_id', fakeUserId, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        // No maxAge - this makes it a session cookie that expires when browser closes
        path: '/',
        domain: cookieDomain,
      });

      this.logger.log('Fake superadmin authentication successful, sending response');

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
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Fake superadmin authentication error', errorStack);
      throw new UnauthorizedError('Fake superadmin authentication failed');
    }
  }

  /**
   * Google OAuth initiation endpoint
   * Uses Passport Google strategy according to NestJS documentation
   * Supports return_url via OAuth2 state parameter
   */
  @Get('google')
  async googleAuth(@Req() req: any, @Res() res: any) {
    try {
      this.logger.log('Google OAuth initiation request received');

      // Get return_url from query params (where to redirect after auth)
      const returnTo = req.query.returnTo || '/meriter/profile';

      // Check if Google OAuth is explicitly disabled
      const enabled = process.env.OAUTH_GOOGLE_ENABLED;
      if (enabled === 'false' || enabled === '0') {
        this.logger.error('Google OAuth is explicitly disabled via OAUTH_GOOGLE_ENABLED');
        throw new Error('Google OAuth is disabled');
      }

      // Get Google OAuth credentials
      // Support both OAUTH_GOOGLE_REDIRECT_URI and OAUTH_GOOGLE_CALLBACK_URL
      // Note: clientSecret is not needed for initiation, only for callback
      const clientId = process.env.OAUTH_GOOGLE_CLIENT_ID;
      const callbackUrl = process.env.OAUTH_GOOGLE_REDIRECT_URI
        || process.env.OAUTH_GOOGLE_CALLBACK_URL
        || process.env.GOOGLE_REDIRECT_URI;

      // Check if credentials are present (clientId and callbackUrl are required for initiation)
      if (!clientId || !callbackUrl) {
        const missing = [];
        if (!clientId) missing.push('OAUTH_GOOGLE_CLIENT_ID');
        if (!callbackUrl) missing.push('OAUTH_GOOGLE_REDIRECT_URI or OAUTH_GOOGLE_CALLBACK_URL');
        this.logger.error(`Google OAuth not configured. Missing: ${missing.join(', ')}`);
        throw new Error(`Google OAuth not configured. Missing: ${missing.join(', ')}`);
      }

      // Construct Google OAuth URL with state parameter containing return_url
      // According to OAuth2 spec, state parameter is used for return_url
      const state = JSON.stringify({ returnTo, return_url: returnTo });

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('email profile')}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${encodeURIComponent(state)}`;

      this.logger.log(`Redirecting to Google OAuth with return_url: ${returnTo}`);
      res.redirect(googleAuthUrl);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Google OAuth initiation error', errorStack);
      throw new InternalServerError('Failed to initiate Google OAuth');
    }
  }

  /**
   * Google OAuth callback endpoint
   * Handles OAuth callback and extracts return_url from OAuth2 state parameter
   * Uses AuthService.authenticateGoogle for code exchange and user creation
   */
  @Get('google/callback')
  async googleCallback(@Req() req: any, @Res() res: any) {
    return this.handleGoogleCallback(req, res);
  }

  /**
   * Alternative Google OAuth callback endpoint
   * Matches OAUTH_GOOGLE_CALLBACK_URL from .env: /api/v1/auth/oauth/google/callback
   */
  @Get('oauth/google/callback')
  async googleCallbackOAuth(@Req() req: any, @Res() res: any) {
    return this.handleGoogleCallback(req, res);
  }

  /**
   * Build full web URL from relative path
   */
  private buildWebUrl(path: string): string {
    if (!path.startsWith('/')) {
      return path; // Already a full URL
    }
    const domain = process.env.DOMAIN || 'localhost';
    const isDocker = process.env.NODE_ENV === 'production';
    const protocol = domain === 'localhost' && !isDocker ? 'http' : (domain === 'localhost' ? 'http' : 'https');
    const webPort = domain === 'localhost' ? ':8001' : '';
    return `${protocol}://${domain}${webPort}${path}`;
  }

  /**
   * Shared handler for Google OAuth callback
   * Handles OAuth callback and extracts return_url from OAuth2 state parameter
   */
  private async handleGoogleCallback(@Req() req: any, @Res() res: any) {
    try {
      this.logger.log('Google OAuth callback received');

      const code = req.query.code;

      if (!code) {
        throw new Error('Authorization code not provided');
      }

      // Authenticate with Google using authorization code
      const result = await this.authService.authenticateGoogle(code);

      // Set JWT cookie
      const cookieDomain = CookieManager.getCookieDomain();
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const isProduction = process.env.NODE_ENV === 'production' || isSecure;

      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);

      // New users go to welcome page, existing users go to profile
      const redirectPath = result.isNewUser ? '/meriter/welcome' : '/meriter/profile';
      const redirectUrl = this.buildWebUrl(redirectPath);

      this.logger.log(`Google authentication successful, isNewUser: ${result.isNewUser}, redirecting to: ${redirectUrl}`);
      res.redirect(redirectUrl);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.logger.error('Google OAuth callback error', errorStack);
      res.redirect(this.buildWebUrl(`/meriter/login?error=${encodeURIComponent(errorMessage)}`));
    }
  }

  /**
   * Yandex OAuth initiation endpoint
   * Supports return_url via OAuth2 state parameter
   */
  @Get('yandex')
  async yandexAuth(@Req() req: any, @Res() res: any) {
    try {
      this.logger.log('Yandex OAuth initiation request received');

      const returnTo = req.query.returnTo || '/meriter/profile';

      // Check if Yandex OAuth is explicitly disabled
      const enabled = process.env.OAUTH_YANDEX_ENABLED;
      if (enabled === 'false' || enabled === '0') {
        this.logger.error('Yandex OAuth is explicitly disabled via OAUTH_YANDEX_ENABLED');
        throw new Error('Yandex OAuth is disabled');
      }

      const clientId = process.env.OAUTH_YANDEX_CLIENT_ID;
      const callbackUrl = process.env.OAUTH_YANDEX_REDIRECT_URI
        || process.env.OAUTH_YANDEX_CALLBACK_URL;

      if (!clientId || !callbackUrl) {
        const missing = [];
        if (!clientId) missing.push('OAUTH_YANDEX_CLIENT_ID');
        if (!callbackUrl) missing.push('OAUTH_YANDEX_REDIRECT_URI');
        this.logger.error(`Yandex OAuth not configured. Missing: ${missing.join(', ')}`);
        throw new Error(`Yandex OAuth not configured. Missing: ${missing.join(', ')}`);
      }

      const state = JSON.stringify({ returnTo, return_url: returnTo });

      const yandexAuthUrl = `https://oauth.yandex.ru/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
        `response_type=code&` +
        `state=${encodeURIComponent(state)}`;

      this.logger.log(`Redirecting to Yandex OAuth with return_url: ${returnTo}`);
      res.redirect(yandexAuthUrl);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Yandex OAuth initiation error', errorStack);
      throw new InternalServerError('Failed to initiate Yandex OAuth');
    }
  }

  /**
   * Yandex OAuth callback endpoint
   */
  @Get('yandex/callback')
  async yandexCallback(@Req() req: any, @Res() res: any) {
    return this.handleYandexCallback(req, res);
  }

  /**
   * Alternative Yandex OAuth callback endpoint
   * Matches OAUTH_YANDEX_CALLBACK_URL: /api/v1/auth/oauth/yandex/callback
   */
  @Get('oauth/yandex/callback')
  async yandexCallbackOAuth(@Req() req: any, @Res() res: any) {
    return this.handleYandexCallback(req, res);
  }

  /**
   * Shared handler for Yandex OAuth callback
   */
  private async handleYandexCallback(@Req() req: any, @Res() res: any) {
    try {
      this.logger.log('Yandex OAuth callback received');

      const code = req.query.code;

      if (!code) {
        throw new Error('Authorization code not provided');
      }

      const result = await this.authService.authenticateYandex(code);

      const cookieDomain = CookieManager.getCookieDomain();
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const isProduction = process.env.NODE_ENV === 'production' || isSecure;

      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);

      // New users go to welcome page, existing users go to profile
      const redirectPath = result.isNewUser ? '/meriter/welcome' : '/meriter/profile';
      const redirectUrl = this.buildWebUrl(redirectPath);

      this.logger.log(`Yandex authentication successful, isNewUser: ${result.isNewUser}, redirecting to: ${redirectUrl}`);
      res.redirect(redirectUrl);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.logger.error('Yandex OAuth callback error', errorStack);
      res.redirect(this.buildWebUrl(`/meriter/login?error=${encodeURIComponent(errorMessage)}`));
    }
  }

  @Get('me')
  @UseGuards(UserGuard)
  async getCurrentUser(@Res() res: any, @Req() req: any) {
    try {
      const user = await this.authService.getCurrentUser(req.user);
      res.json({ success: true, data: user });
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Get current user error', errorStack);
      throw new InternalServerError('Failed to get user information');
    }
  }

  // --- WebAuthn / Passkeys Endpoints ---

  @Post('passkey/register/start')
  async generatePasskeyRegistrationOptions(@Body() body: { username?: string; userId?: string }, @Res() res: any) {
    try {
      if (process.env.AUTHN_ENABLED !== 'true') throw new ForbiddenException('Passkeys disabled');

      const { username, userId } = body;
      if (!username && !userId) throw new Error('Username or userId required');

      // If linking to existing user (userId provided), ensure it matches authenticated user or skip if open registration?
      // For ease, we trust the client for now but in "Bind" flow, we should check req.user if protected.
      // Ideally, binding a second device should be a protected route.
      // But for now, we follow the simple plan. 

      const result = await this.authService.generatePasskeyRegistrationOptions(username || 'user', userId);
      // Return raw JSON without wrapper (required by @simplewebauthn/browser)
      return res.json(result);
    } catch (error) {
      this.logger.error('Passkey reg options error', error);
      throw new InternalServerError('Failed to generate passkey options');
    }
  }

  @Post('passkey/register/finish')
  async verifyPasskeyRegistration(@Body() body: any, @Res() res: any, @Req() req: any) {
    try {
      if (process.env.AUTHN_ENABLED !== 'true') throw new ForbiddenException('Passkeys disabled');

      // The body contains the registration response and context
      // We expect { userId: "...", deviceName: "...", ...credentialResponse }
      // Or we just pass body.
      const userIdOrUsername = body.userId; // This might be "new_username" or real ID
      const deviceName = body.deviceName;

      const result = await this.authService.verifyPasskeyRegistration(body, userIdOrUsername, deviceName);

      // Set JWT cookie (sign-up + sign-in)
      const cookieDomain = CookieManager.getCookieDomain();
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const isProduction = process.env.NODE_ENV === 'production' || isSecure;

      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      if (result.jwt) {
        CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);
      }

      return res.json({
        success: true,
        ...result
      });
    } catch (error) {
      this.logger.error('Passkey reg verify error', error);
      throw new InternalServerError('Failed to verify passkey registration');
    }
  }

  @Post('passkey/login/start')
  async generatePasskeyLoginOptions(@Body() body: { username?: string }) {
    try {
      if (process.env.AUTHN_ENABLED !== 'true') throw new ForbiddenException('Passkeys disabled');
      const result = await this.authService.generatePasskeyLoginOptions(body.username);
      return result;
    } catch (error) {
      this.logger.error('Passkey login options error', error);
      throw new InternalServerError('Failed to generate passkey login options');
    }
  }

  @Post('passkey/login/finish')
  async verifyPasskeyLogin(@Body() body: any, @Res() res: any, @Req() req: any) {
    try {
      if (process.env.AUTHN_ENABLED !== 'true') throw new ForbiddenException('Passkeys disabled');

      const result = await this.authService.verifyPasskeyLogin(body);

      // Set JWT cookie
      const cookieDomain = CookieManager.getCookieDomain();
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const isProduction = process.env.NODE_ENV === 'production' || isSecure;

      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);

      return res.json({ success: true, user: result.user });
    } catch (error) {
      this.logger.error('Passkey login verify error', error);
      throw new InternalServerError('Failed to verify passkey login');
    }
  }

  /**
   * Unified Passkey Authentication Start (combines login + registration)
   * Works like OAuth: single endpoint, auto-determines flow
   */
  @Post('passkey/authenticate/start')
  async generatePasskeyAuthenticationOptions(@Res() res: any) {
    try {
      if (process.env.AUTHN_ENABLED !== 'true') {
        throw new ForbiddenException('Passkeys disabled');
      }

      const result = await this.authService.generatePasskeyAuthenticationOptions();
      // Return raw JSON without wrapper (required by @simplewebauthn/browser)
      return res.json(result);
    } catch (error) {
      this.logger.error('Passkey authentication options error', error);
      throw new InternalServerError('Failed to generate passkey authentication options');
    }
  }

  /**
   * Unified Passkey Authentication (combines login + registration)
   * Works like OAuth: single endpoint, auto-creates user if doesn't exist
   */
  @Post('passkey/authenticate/finish')
  async authenticateWithPasskey(@Body() body: any, @Res() res: any, @Req() req: any) {
    try {
      if (process.env.AUTHN_ENABLED !== 'true') {
        throw new ForbiddenException('Passkeys disabled');
      }

      const result = await this.authService.authenticateWithPasskey(body);

      // Set JWT cookie (same as OAuth)
      const cookieDomain = CookieManager.getCookieDomain();
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const isProduction = process.env.NODE_ENV === 'production' || isSecure;

      CookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      CookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction);

      // Return isNewUser flag for frontend redirect (like OAuth)
      return res.json({
        success: true,
        user: result.user,
        isNewUser: result.isNewUser,
      });
    } catch (error) {
      this.logger.error('Passkey authentication error', error);
      throw new InternalServerError('Failed to authenticate with passkey');
    }
  }
}
