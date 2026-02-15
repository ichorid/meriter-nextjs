import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  Param,
  UseGuards,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProviderService } from './auth.service';
import { AuthMagicLinkService } from './auth-magic-link.service';
import { SmsProviderService } from './sms-provider.service';
import { EmailProviderService } from './email-provider.service';
import { UserGuard } from '../../user.guard';
import { CookieManager } from '../common/utils/cookie-manager.util';
import { UnauthorizedError, InternalServerError } from '../../common/exceptions/api.exceptions';
import { AppConfig } from '../../config/configuration';

/**
 * Authentication Controller
 * 
 * REST endpoints for authentication flows:
 * - Public/unauthenticated endpoints (fake auth, clearCookies) - use REST for simplicity
 * - OAuth redirects and callbacks - must stay REST (required by OAuth spec)
 * - Passkey/WebAuthn endpoints - use REST (WebAuthn requires REST)
 * 
 * Authenticated endpoints:
 * - POST /api/v1/auth/logout -> Use trpc.auth.logout (authenticated only)
 * - GET /api/v1/auth/me -> @deprecated Use trpc.users.getMe instead
 */
/** In-memory rate limit for magic-link redeem: max 30 requests per minute per IP. */
const MAGIC_LINK_RATE_LIMIT_PER_MIN = 30;

@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  /** IP -> { count, resetAt } for GET /link/:token rate limiting. */
  private readonly magicLinkRateLimit = new Map<string, { count: number; resetAt: number }>();

  private getClientIp(req: unknown): string {
    const r = req as { ip?: string; headers?: Record<string, unknown>; connection?: { remoteAddress?: string } } | null;
    const forwarded = r?.headers?.['x-forwarded-for'];
    if (forwarded) {
      const raw = Array.isArray(forwarded) ? forwarded[0] : String(forwarded);
      return String(raw).split(',')[0]?.trim() || 'unknown';
    }
    if (r?.ip) return r.ip;
    return r?.connection?.remoteAddress ?? 'unknown';
  }

  private isMagicLinkRedeemRateLimited(req: unknown): boolean {
    const ip = this.getClientIp(req);
    const now = Date.now();
    const windowMs = 60 * 1000;
    let entry = this.magicLinkRateLimit.get(ip);
    if (!entry || entry.resetAt < now) {
      entry = { count: 1, resetAt: now + windowMs };
      this.magicLinkRateLimit.set(ip, entry);
      return false;
    }
    entry.count += 1;
    if (entry.count > MAGIC_LINK_RATE_LIMIT_PER_MIN) {
      return true;
    }
    return false;
  }

  private isHttpsRequest(req: unknown): boolean {
    const r = req as { secure?: unknown; headers?: Record<string, unknown> } | null;
    if (r?.secure === true) return true;
    const forwardedProto = r?.headers?.['x-forwarded-proto'];
    if (!forwardedProto) return false;
    const raw = Array.isArray(forwardedProto) ? forwardedProto[0] : String(forwardedProto);
    const first = raw.split(',')[0]?.trim().toLowerCase();
    return first === 'https';
  }

  private getSanitizedSetCookieHeader(res: unknown): string[] | null {
    try {
      const r = res as { getHeader?: (name: string) => unknown } | null;
      const raw = r?.getHeader?.('Set-Cookie');
      const values: string[] =
        typeof raw === 'string'
          ? [raw]
          : Array.isArray(raw)
            ? raw.map(String)
            : raw
              ? [String(raw)]
              : [];

      if (values.length === 0) return null;

      return values.map((v) =>
        v
          // redact jwt value
          .replace(/(^|;\s*)jwt=[^;]*/i, '$1jwt=<redacted>')
          // redact any fake ids
          .replace(/(^|;\s*)fake_user_id=[^;]*/i, '$1fake_user_id=<redacted>')
          .replace(/(^|;\s*)fake_superadmin_id=[^;]*/i, '$1fake_superadmin_id=<redacted>')
      );
    } catch {
      return null;
    }
  }

  constructor(
    private readonly authService: AuthProviderService,
    private readonly authMagicLinkService: AuthMagicLinkService,
    private readonly smsProviderService: SmsProviderService,
    private readonly emailProviderService: EmailProviderService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly cookieManager: CookieManager,
  ) {}

  // Telegram authentication endpoints removed: Telegram is fully disabled in this project.

  @Post('logout')
  async logout(@Res() res: any) {
    this.logger.log('User logout request');

    // Clear the JWT cookie
    const cookieDomain = this.cookieManager.getCookieDomain();
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';
    this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);

    return res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }

  @Post('clear-cookies')
  async clearCookies(@Req() req: any, @Res() res: any) {
    // Clear ALL cookies from the request, not just JWT variants
    // This prevents login loops caused by stale cookies with mismatched attributes
    const cookieDomain = this.cookieManager.getCookieDomain();
    const isSecure = this.isHttpsRequest(req);
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production' || isSecure;

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
      this.cookieManager.clearCookieVariants(res, cookieName, cookieDomain, isProduction);
    }

    return res.json({
      success: true,
      data: { message: 'Cookies cleared successfully' },
    });
  }

  @Post('fake')
  async authenticateFake(@Req() req: any, @Res() res: any) {
    try {
      // Check if fake data mode or test auth mode is enabled
      const fakeDataMode = this.configService.get('dev')?.fakeDataMode ?? false;
      const testAuthMode = this.configService.get('dev')?.testAuthMode ?? false;
      if (!fakeDataMode && !testAuthMode) {
        throw new ForbiddenException('Fake data mode or test auth mode is not enabled');
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
      const cookieDomain = this.cookieManager.getCookieDomain();
      // Treat as production (Secure=true, SameSite=None) if explicitly production OR if accessed via HTTPS
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      // Clear any existing JWT cookie first to ensure clean state
      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);

      // Set new JWT cookie (pass req to detect HTTPS reliably)
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

      // Set fake_user_id cookie (session cookie - expires when browser closes)
      // Recalculate isSecure to ensure it's correct (trust proxy should make req.secure work)
      const actualIsSecure = this.isHttpsRequest(req);
      // Recalculate isProduction with actual isSecure value
      const actualIsProduction = nodeEnv === 'production' || actualIsSecure;
      const sameSite = 'lax' as const;
      const secure = actualIsSecure || actualIsProduction;
      res.cookie('fake_user_id', fakeUserId, {
        httpOnly: true,
        secure,
        sameSite,
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

  /**
   * Mock authentication endpoints for test auth mode
   * These endpoints create real users in the database but bypass OAuth/SMS/Email flows
   */
  @Post('mock/:provider')
  async authenticateMock(
    @Param('provider') provider: string,
    @Req() req: any,
    @Res() res: any,
    @Body() body: any,
  ) {
    try {
      // Check if test auth mode is enabled
      const testAuthMode = this.configService.get('dev')?.testAuthMode ?? false;
      if (!testAuthMode) {
        throw new ForbiddenException('Test auth mode is not enabled');
      }
      this.logger.log(`Mock authentication request for provider: ${provider}`);

      let result: {
        user: any;
        hasPendingCommunities: boolean;
        isNewUser: boolean;
        jwt: string;
      };

      switch (provider) {
        case 'google':
        case 'yandex':
        case 'vk':
        case 'telegram':
        case 'apple':
        case 'twitter':
        case 'instagram':
        case 'sber':
        case 'mailru': {
          const identifier = body.identifier || `mock_${provider}_user@example.com`;
          const displayName = body.displayName || identifier.split('@')[0];
          result = await this.authService.authenticateWithProvider({
            provider,
            providerId: identifier,
            email: identifier.includes('@') ? identifier : `${identifier}@example.com`,
            firstName: displayName.split(' ')[0] || 'User',
            lastName: displayName.split(' ').slice(1).join(' ') || '',
            displayName,
            avatarUrl: undefined,
          });
          break;
        }
        case 'sms': {
          const phoneNumber = body.phoneNumber;
          if (!phoneNumber) {
            throw new Error('Phone number is required');
          }
          result = await this.authService.authenticateSms(phoneNumber);
          break;
        }
        case 'email': {
          const email = body.email;
          if (!email) {
            throw new Error('Email is required');
          }
          result = await this.authService.authenticateEmail(email);
          break;
        }
        case 'phone': {
          const phoneNumber = body.phoneNumber;
          if (!phoneNumber) {
            throw new Error('Phone number is required');
          }
          result = await this.authService.authenticateSms(phoneNumber); // Reuse SMS logic
          break;
        }
        case 'passkey': {
          const credentialId = body.credentialId || `passkey_${Date.now()}`;
          // For passkey, we'll use a mock identifier
          result = await this.authService.authenticateEmail(`passkey_${credentialId}@example.com`);
          break;
        }
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Set JWT cookie
      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

      return res.json({
        success: true,
        user: result.user,
        isNewUser: result.isNewUser,
        jwt: result.jwt,
      });
    } catch (error: any) {
      this.logger.error(`Mock authentication error: ${error.message}`, error.stack);
      throw new UnauthorizedError(error.message || 'Mock authentication failed');
    }
  }

  @Post('fake/superadmin')
  async authenticateFakeSuperadmin(@Req() req: any, @Res() res: any) {
    try {
      // Check if fake data mode or test auth mode is enabled
      const fakeDataMode = this.configService.get('dev')?.fakeDataMode ?? false;
      const testAuthMode = this.configService.get('dev')?.testAuthMode ?? false;
      if (!fakeDataMode && !testAuthMode) {
        throw new ForbiddenException('Fake data mode or test auth mode is not enabled');
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
      const cookieDomain = this.cookieManager.getCookieDomain();
      // Treat as production (Secure=true, SameSite=None) if explicitly production OR if accessed via HTTPS
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      // Clear any existing JWT cookie first to ensure clean state
      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);

      // Set new JWT cookie (pass req to detect HTTPS reliably)
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

      // Set fake_superadmin_id cookie (session cookie - expires when browser closes)
      // Recalculate isSecure to ensure it's correct (trust proxy should make req.secure work)
      const actualIsSecure = this.isHttpsRequest(req);
      // Recalculate isProduction with actual isSecure value
      const actualIsProduction = nodeEnv === 'production' || actualIsSecure;
      const sameSite = 'lax' as const;
      const secure = actualIsSecure || actualIsProduction;
      res.cookie('fake_superadmin_id', fakeUserId, {
        httpOnly: true,
        secure,
        sameSite,
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
      const enabled = this.configService.get('oauth')?.google.enabled;
      if (enabled === false) {
        this.logger.error('Google OAuth is explicitly disabled via OAUTH_GOOGLE_ENABLED');
        throw new Error('Google OAuth is disabled');
      }

      // Get Google OAuth credentials
      // Support both OAUTH_GOOGLE_REDIRECT_URI and OAUTH_GOOGLE_CALLBACK_URL
      // Note: clientSecret is not needed for initiation, only for callback
      const clientId = this.configService.get('oauth')?.google.clientId;
      const callbackUrl = this.configService.get('oauth')?.google.redirectUri
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
   * Uses AuthProviderService.authenticateGoogle for code exchange and user creation
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
    const domain = this.configService.get('DOMAIN', 'localhost');
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const isDocker = nodeEnv === 'production';
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
      // For OAuth callbacks, use minimal clearing (host-only) to avoid Set-Cookie header bloat
      // which can cause truncation and prevent the cookie from being set properly
      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearHostOnlyJwtCookie(res, isProduction);
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

      // Debug: log cookie attributes (sanitized) to diagnose cookie rejection in browsers.
      // Safe to keep at debug level; does not log token values.
      this.logger.debug(
        `[cookie-debug] google callback host=${req?.headers?.host} xfHost=${req?.headers?.['x-forwarded-host']} xfProto=${req?.headers?.['x-forwarded-proto']} req.secure=${String(req?.secure)} isSecure=${String(isSecure)} isProduction=${String(isProduction)} set-cookie=${JSON.stringify(this.getSanitizedSetCookieHeader(res))}`
      );

      // New users go to welcome page, existing users go to profile
      const redirectPath = result.isNewUser ? '/meriter/welcome' : '/meriter/profile';

      // Redirect to intermediate callback page to avoid SameSite=Lax cookie issues
      // The callback page will retry users.getMe until cookie is available, then redirect to final destination
      const callbackUrl = this.buildWebUrl(`/meriter/auth/callback?returnTo=${encodeURIComponent(redirectPath)}`);

      this.logger.log(`Google authentication successful, isNewUser: ${result.isNewUser}, redirecting to callback page: ${callbackUrl}`);
      res.redirect(callbackUrl);
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
      const enabled = this.configService.get('oauth')?.yandex.enabled;
      if (enabled === false) {
        this.logger.error('Yandex OAuth is explicitly disabled via OAUTH_YANDEX_ENABLED');
        throw new Error('Yandex OAuth is disabled');
      }

      const clientId = this.configService.get('oauth')?.yandex.clientId;
      const callbackUrl = this.configService.get('oauth')?.yandex.redirectUri;

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

      // Set JWT cookie
      // For OAuth callbacks, use minimal clearing (host-only) to avoid Set-Cookie header bloat
      // which can cause truncation and prevent the cookie from being set properly
      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearHostOnlyJwtCookie(res, isProduction);
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

      this.logger.debug(
        `[cookie-debug] yandex callback host=${req?.headers?.host} xfHost=${req?.headers?.['x-forwarded-host']} xfProto=${req?.headers?.['x-forwarded-proto']} req.secure=${String(req?.secure)} isSecure=${String(isSecure)} isProduction=${String(isProduction)} set-cookie=${JSON.stringify(this.getSanitizedSetCookieHeader(res))}`
      );

      // New users go to welcome page, existing users go to profile
      const redirectPath = result.isNewUser ? '/meriter/welcome' : '/meriter/profile';

      // Redirect to intermediate callback page to avoid SameSite=Lax cookie issues
      // The callback page will retry users.getMe until cookie is available, then redirect to final destination
      const callbackUrl = this.buildWebUrl(`/meriter/auth/callback?returnTo=${encodeURIComponent(redirectPath)}`);

      this.logger.log(`Yandex authentication successful, isNewUser: ${result.isNewUser}, redirecting to callback page: ${callbackUrl}`);
      res.redirect(callbackUrl);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      this.logger.error('Yandex OAuth callback error', errorStack);
      res.redirect(this.buildWebUrl(`/meriter/login?error=${encodeURIComponent(errorMessage)}`));
    }
  }

  /**
   * @deprecated Use trpc.users.getMe instead. This endpoint is deprecated.
   */
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
      if (!(this.configService.get('authn')?.enabled ?? false)) throw new ForbiddenException('Passkeys disabled');

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
      if (!(this.configService.get('authn')?.enabled ?? false)) throw new ForbiddenException('Passkeys disabled');

      // The body contains the registration response and context
      // We expect { userId: "...", deviceName: "...", ...credentialResponse }
      // Or we just pass body.
      const userIdOrUsername = body.userId; // This might be "new_username" or real ID
      const deviceName = body.deviceName;

      const result = await this.authService.verifyPasskeyRegistration(body, userIdOrUsername, deviceName);

      // Set JWT cookie (sign-up + sign-in)
      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      if (result.jwt) {
        this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);
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
      if (!(this.configService.get('authn')?.enabled ?? false)) throw new ForbiddenException('Passkeys disabled');
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
      if (!(this.configService.get('authn')?.enabled ?? false)) throw new ForbiddenException('Passkeys disabled');

      const result = await this.authService.verifyPasskeyLogin(body);

      // Set JWT cookie
      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

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
      if (!(this.configService.get('authn')?.enabled ?? false)) {
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
      if (!(this.configService.get('authn')?.enabled ?? false)) {
        throw new ForbiddenException('Passkeys disabled');
      }

      const result = await this.authService.authenticateWithPasskey(body);

      // Set JWT cookie (same as OAuth)
      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

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

  // --- SMS Authentication Endpoints ---

  /**
   * Send OTP to phone number
   * POST /api/v1/auth/sms/send
   */
  @Post('sms/send')
  async sendSmsOtp(@Body() body: { phoneNumber: string }, @Res() res: any) {
    try {
      const { phoneNumber } = body;

      if (!phoneNumber) {
        throw new Error('Phone number is required');
      }

      // Validate E.164 format
      if (!phoneNumber.startsWith('+')) {
        throw new Error('Phone number must be in E.164 format (start with +)');
      }

      // Check if SMS is enabled
      const smsEnabled = this.configService.get('sms')?.enabled ?? false;
      if (!smsEnabled) {
        throw new ForbiddenException('SMS authentication is not enabled');
      }

      this.logger.log(`SMS OTP send request for ${phoneNumber}`);

      const result = await this.smsProviderService.sendOtp(phoneNumber);

      this.logger.log(`OTP sent successfully to ${phoneNumber}`);

      return res.json({
        success: true,
        expiresIn: result.expiresIn,
        canResendAt: result.canResendAt,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to send SMS';
      this.logger.error(`SMS send error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }

  /**
   * Verify OTP and authenticate user
   * POST /api/v1/auth/sms/verify
   */
  @Post('sms/verify')
  async verifySmsOtp(@Body() body: { phoneNumber: string; otpCode: string }, @Req() req: any, @Res() res: any) {
    try {
      const { phoneNumber, otpCode } = body;

      if (!phoneNumber || !otpCode) {
        throw new Error('Phone number and OTP code are required');
      }

      // Validate E.164 format
      if (!phoneNumber.startsWith('+')) {
        throw new Error('Phone number must be in E.164 format (start with +)');
      }

      // Check if SMS is enabled
      const smsEnabled = this.configService.get('sms')?.enabled ?? false;
      if (!smsEnabled) {
        throw new ForbiddenException('SMS authentication is not enabled');
      }

      this.logger.log(`SMS OTP verify request for ${phoneNumber}`);

      // Verify OTP
      await this.smsProviderService.verifyOtp(phoneNumber, otpCode);

      // Authenticate user (create or login)
      const result = await this.authService.authenticateSms(phoneNumber);

      // Set JWT cookie
      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

      this.logger.log(`SMS authentication successful for ${phoneNumber}, isNewUser: ${result.isNewUser}`);

      return res.json({
        success: true,
        user: result.user,
        isNewUser: result.isNewUser,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify SMS';
      this.logger.error(`SMS verify error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }

  /**
   * Redeem magic link (one-time auth link from SMS/email).
   * GET /api/v1/auth/link/:token
   * Redirects to app with JWT cookie on success, or to login with error on invalid/expired/used token.
   */
  @Get('link/:token')
  async redeemMagicLink(
    @Param('token') token: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const appUrl = this.configService.get('app')?.url ?? this.configService.get('APP_URL') ?? 'http://localhost';
    const loginUrl = `${appUrl}/meriter/login?error=link_expired`;
    const profileUrl = `${appUrl}/meriter/profile`;

    if (this.isMagicLinkRedeemRateLimited(req)) {
      this.logger.warn('Magic link redeem rate limit exceeded');
      return res.redirect(302, loginUrl);
    }

    const result = await this.authMagicLinkService.redeem(token);
    if (!result) {
      return res.redirect(302, loginUrl);
    }

    try {
      const authResult =
        result.channel === 'sms'
          ? await this.authService.authenticateSms(result.target)
          : await this.authService.authenticateEmail(result.target);

      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      this.cookieManager.setJwtCookie(res, authResult.jwt, cookieDomain, isProduction, req);

      this.logger.log(`Magic link auth successful for ${result.channel}`);
      return res.redirect(302, profileUrl);
    } catch (error) {
      this.logger.error(`Magic link redeem auth failed: ${error}`);
      return res.redirect(302, loginUrl);
    }
  }

  /**
   * Initiate Call Check (Flash Call / Call by User)
   * POST /api/v1/auth/call/init
   */
  @Post('call/init')
  async initCallCheck(@Body() body: { phoneNumber: string }, @Res() res: any) {
    try {
      const { phoneNumber } = body;
      if (!phoneNumber) throw new Error('Phone number is required');

      // Check if Phone/Call Check is enabled
      const enabled = this.configService.get('phone')?.enabled ?? false;
      if (!enabled) {
        throw new ForbiddenException('Call authentication is not enabled');
      }

      const result = await this.smsProviderService.initiateCallVerification(phoneNumber);

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Failed to init call check';
      this.logger.error(`Call check init error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }

  /**
   * Check Call Status and Authenticate
   * POST /api/v1/auth/call/status
   */
  @Post('call/status')
  async checkCallStatus(@Body() body: { checkId: string; phoneNumber: string }, @Req() req: any, @Res() res: any) {
    try {
      const { checkId, phoneNumber } = body;
      if (!checkId || !phoneNumber) throw new Error('checkId and phoneNumber are required');

      // Check if Phone/Call Check is enabled
      const enabled = this.configService.get('phone')?.enabled ?? false;
      if (!enabled) {
        throw new ForbiddenException('Call authentication is not enabled');
      }

      // Check status
      const statusResult = await this.smsProviderService.verifyCallStatus(checkId);

      if (statusResult.status === 'CONFIRMED') {
        // Authenticate User
        const result = await this.authService.authenticateSms(phoneNumber);

        // Set JWT
        const cookieDomain = this.cookieManager.getCookieDomain();
        const isSecure = this.isHttpsRequest(req);
        const nodeEnv = this.configService.get('NODE_ENV', 'development');
        const isProduction = nodeEnv === 'production' || isSecure;

        this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
        this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

        return res.json({
          success: true,
          status: 'CONFIRMED',
          user: result.user,
          isNewUser: result.isNewUser,
        });
      }

      // If not confirmed yet, just return status
      return res.json({
        success: true,
        status: statusResult.status,
      });

    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Failed to check call status';
      // Don't log expected pending/error checking noise too loudly? 
      // Actually errors here might be real API errors.
      this.logger.error(`Call check status error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }

  // --- Email Authentication Endpoints ---

  @Post('email/send')
  async sendEmailOtp(@Body() body: { email: string }, @Res() res: any) {
    try {
      const { email } = body;
      if (!email) throw new Error('Email is required');

      const enabled = this.configService.get('email')?.enabled ?? false;
      if (!enabled) throw new ForbiddenException('Email authentication is not enabled');

      this.logger.log(`Email OTP send request for ${email}`);
      const result = await this.emailProviderService.sendOtp(email);

      return res.json({
        success: true,
        expiresIn: result.expiresIn,
        canResendAt: result.canResendAt,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Failed to send Email';
      this.logger.error(`Email send error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }

  @Post('email/verify')
  async verifyEmailOtp(@Body() body: { email: string; otpCode: string }, @Req() req: any, @Res() res: any) {
    try {
      const { email, otpCode } = body;
      if (!email || !otpCode) throw new Error('Email and Code are required');

      const enabled = this.configService.get('email')?.enabled ?? false;
      if (!enabled) throw new ForbiddenException('Email authentication is not enabled');

      // Verify OTP
      await this.emailProviderService.verifyOtp(email, otpCode);

      // Authenticate
      const result = await this.authService.authenticateEmail(email);

      // Set JWT
      const cookieDomain = this.cookieManager.getCookieDomain();
      const isSecure = this.isHttpsRequest(req);
      const nodeEnv = this.configService.get('NODE_ENV', 'development');
      const isProduction = nodeEnv === 'production' || isSecure;

      this.cookieManager.clearAllJwtCookieVariants(res, cookieDomain, isProduction);
      this.cookieManager.setJwtCookie(res, result.jwt, cookieDomain, isProduction, req);

      return res.json({
        success: true,
        user: result.user,
        isNewUser: result.isNewUser,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify Email';
      this.logger.error(`Email verify error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }
}
