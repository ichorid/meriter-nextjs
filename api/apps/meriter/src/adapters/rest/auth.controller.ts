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
import { AuthProviderService } from '../../api-v1/auth/auth.service';
import { AuthMagicLinkService } from '../../api-v1/auth/auth-magic-link.service';
import { SmsProviderService } from '../../api-v1/auth/sms-provider.service';
import { EmailLoginLinkService } from '../../infrastructure/auth/email-login-link.service';
import { UserGuard } from '../../user.guard';
import { CookieManager } from '../../infrastructure/auth/cookie-manager';
import { UnauthorizedError, InternalServerError } from '../../common/exceptions/api.exceptions';
import { AppConfig } from '../../config/configuration';
import {
  EstablishSessionUseCase,
  FakeAuthDisabledError,
} from '../../application/use-cases/auth/establish-session.use-case';
import {
  InitiateOAuthUseCase,
  OAuthDisabledError,
  OAuthNotConfiguredError,
} from '../../application/use-cases/auth/initiate-oauth.use-case';
import {
  CompleteOAuthCallbackUseCase,
  OAuthAuthorizationCodeMissingError,
} from '../../application/use-cases/auth/complete-oauth-callback.use-case';
import {
  RegisterPasskeyUseCase,
  PasskeyAuthDisabledError,
  PasskeyRegistrationIdentityRequiredError,
} from '../../application/use-cases/auth/register-passkey.use-case';
import { AuthenticatePasskeyUseCase } from '../../application/use-cases/auth/authenticate-passkey.use-case';
import {
  SendSmsOtpUseCase,
  SmsAuthDisabledError,
  PhoneNumberRequiredError,
  InvalidPhoneNumberError,
} from '../../application/use-cases/auth/send-sms-otp.use-case';
import {
  VerifySmsOtpUseCase,
  OtpCodeRequiredError,
} from '../../application/use-cases/auth/verify-sms-otp.use-case';
import {
  SendEmailLoginLinkUseCase,
  EmailAuthDisabledError,
  EmailRequiredError,
} from '../../application/use-cases/auth/send-email-login-link.use-case';
import { RedeemMagicLinkUseCase } from '../../application/use-cases/auth/redeem-magic-link.use-case';
import {
  VerifyCallCheckUseCase,
  CallAuthDisabledError,
  CallCheckParamsRequiredError,
} from '../../application/use-cases/auth/verify-call-check.use-case';
import {
  AuthenticateDemoPersonaUseCase,
  DemoPersonaAuthDisabledError,
  DemoPersonaNotAllowedError,
} from '../../application/use-cases/auth/authenticate-demo-persona.use-case';
import { PlatformSettingsService } from '../../domain/services/platform-settings.service';
import { PlatformEntrepreneursDemoSeedService } from '../../domain/services/platform-entrepreneurs-demo-seed.service';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';

/**
 * BC-12 REST auth adapter (Phase 8). Thin transport layer delegating to use cases.
 * inv-18: REST response envelopes stay distinct from tRPC (see per-endpoint res.json shapes).
 *
 * - OAuth redirects/callbacks — REST (OAuth spec)
 * - Passkey/WebAuthn — REST (@simplewebauthn/browser raw JSON on start endpoints)
 * - POST /api/v1/auth/logout -> prefer trpc.auth.logout
 * - GET /api/v1/auth/me -> @deprecated; use trpc.users.getMe
 */
/** In-memory rate limit for magic-link redeem: max 30 requests per minute per IP. */
const MAGIC_LINK_RATE_LIMIT_PER_MIN = 30;

@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly establishSessionUseCase: EstablishSessionUseCase;
  private readonly initiateOAuthUseCase: InitiateOAuthUseCase;
  private readonly completeOAuthCallbackUseCase: CompleteOAuthCallbackUseCase;
  private readonly registerPasskeyUseCase: RegisterPasskeyUseCase;
  private readonly authenticatePasskeyUseCase: AuthenticatePasskeyUseCase;
  private readonly sendSmsOtpUseCase: SendSmsOtpUseCase;
  private readonly verifySmsOtpUseCase: VerifySmsOtpUseCase;
  private readonly sendEmailLoginLinkUseCase: SendEmailLoginLinkUseCase;
  private readonly redeemMagicLinkUseCase: RedeemMagicLinkUseCase;
  private readonly verifyCallCheckUseCase: VerifyCallCheckUseCase;
  private readonly authenticateDemoPersonaUseCase: AuthenticateDemoPersonaUseCase;

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
    private readonly emailLoginLinkService: EmailLoginLinkService,
    private readonly configService: ConfigService<AppConfig>,
    private readonly cookieManager: CookieManager,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly entrepreneursDemoSeedService: PlatformEntrepreneursDemoSeedService,
  ) {
    this.establishSessionUseCase = new EstablishSessionUseCase(
      this.cookieManager,
      this.configService,
      this.authService,
    );
    this.authenticateDemoPersonaUseCase = new AuthenticateDemoPersonaUseCase(
      this.platformSettingsService,
      this.entrepreneursDemoSeedService,
      this.establishSessionUseCase,
    );
    this.initiateOAuthUseCase = new InitiateOAuthUseCase(this.configService);
    this.completeOAuthCallbackUseCase = new CompleteOAuthCallbackUseCase(
      this.configService,
      this.authService,
      this.establishSessionUseCase,
    );
    this.registerPasskeyUseCase = new RegisterPasskeyUseCase(
      this.configService,
      this.authService,
      this.establishSessionUseCase,
    );
    this.authenticatePasskeyUseCase = new AuthenticatePasskeyUseCase(
      this.configService,
      this.authService,
      this.establishSessionUseCase,
    );
    this.sendSmsOtpUseCase = new SendSmsOtpUseCase(this.configService, this.smsProviderService);
    this.verifySmsOtpUseCase = new VerifySmsOtpUseCase(
      this.configService,
      this.smsProviderService,
      this.authService,
      this.establishSessionUseCase,
    );
    this.sendEmailLoginLinkUseCase = new SendEmailLoginLinkUseCase(
      this.configService,
      this.emailLoginLinkService,
    );
    this.redeemMagicLinkUseCase = new RedeemMagicLinkUseCase(
      this.authMagicLinkService,
      this.authService,
      this.establishSessionUseCase,
    );
    this.verifyCallCheckUseCase = new VerifyCallCheckUseCase(
      this.configService,
      this.smsProviderService,
      this.authService,
      this.establishSessionUseCase,
    );
  }

  // Telegram authentication endpoints removed: Telegram is fully disabled in this project.

  @Post('logout')
  async logout(@Res() res: any) {
    this.logger.log('User logout request');

    this.cookieManager.logoutJwt(res);

    return res.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }

  @Post('clear-cookies')
  async clearCookies(@Req() req: any, @Res() res: any) {
    this.cookieManager.clearAllRequestCookies(res, req);

    return res.json({
      success: true,
      data: { message: 'Cookies cleared successfully' },
    });
  }

  @Post('fake')
  async authenticateFake(@Req() req: any, @Res() res: any) {
    try {
      this.logger.log('Fake authentication request received');

      const result = await this.establishSessionUseCase.authenticateFakeUser(req, res);

      this.logger.log('Fake authentication successful, sending response');

      return res.json({
        success: true,
        data: {
          user: result.user,
          hasPendingCommunities: result.hasPendingCommunities,
        },
      });
    } catch (error) {
      if (error instanceof FakeAuthDisabledError) {
        throw new ForbiddenException(error.message);
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

      this.establishSessionUseCase.establishJwtSession(res, result.jwt, req);

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
      this.logger.log('Fake superadmin authentication request received');

      const result = await this.establishSessionUseCase.authenticateFakeSuperadmin(req, res);

      this.logger.log('Fake superadmin authentication successful, sending response');

      return res.json({
        success: true,
        data: {
          user: result.user,
          hasPendingCommunities: result.hasPendingCommunities,
        },
      });
    } catch (error) {
      if (error instanceof FakeAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Fake superadmin authentication error', errorStack);
      throw new UnauthorizedError('Fake superadmin authentication failed');
    }
  }

  @Post('demo-persona')
  async authenticateDemoPersona(
    @Req() req: any,
    @Res() res: any,
    @Body() body: { authId?: string },
  ) {
    const authId = body?.authId?.trim();
    if (!authId) {
      throw new UnauthorizedError('authId is required');
    }

    try {
      const jwtUser = req.user as { globalRole?: string } | undefined;
      const result = await this.authenticateDemoPersonaUseCase.authenticate(
        req,
        res,
        authId,
        { isSuperadmin: jwtUser?.globalRole === GLOBAL_ROLE_SUPERADMIN },
      );

      return res.json({
        success: true,
        data: {
          user: result.user,
          hasPendingCommunities: result.hasPendingCommunities,
        },
      });
    } catch (error) {
      if (
        error instanceof DemoPersonaAuthDisabledError ||
        error instanceof DemoPersonaNotAllowedError
      ) {
        throw new ForbiddenException(
          error instanceof Error ? error.message : 'Demo persona login forbidden',
        );
      }
      const errorStack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Demo persona authentication error', errorStack);
      throw new UnauthorizedError('Demo persona authentication failed');
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
      const returnTo = req.query.returnTo;
      const { authUrl, returnTo: resolvedReturnTo } = this.initiateOAuthUseCase.initiateGoogle(returnTo);
      this.logger.log(`Redirecting to Google OAuth with return_url: ${resolvedReturnTo}`);
      res.redirect(authUrl);
    } catch (error) {
      if (error instanceof OAuthDisabledError || error instanceof OAuthNotConfiguredError) {
        this.logger.error(error.message);
      }
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
   * Shared handler for Google OAuth callback
   */
  private async handleGoogleCallback(@Req() req: any, @Res() res: any) {
    try {
      this.logger.log('Google OAuth callback received');

      const result = await this.completeOAuthCallbackUseCase.completeGoogleCallback({
        code: req.query.code,
        response: res,
        request: req,
      });

      const isSecure = this.cookieManager.isRequestSecure(req);
      const isProduction = this.cookieManager.resolveIsProduction(req);
      this.logger.debug(
        `[cookie-debug] google callback host=${req?.headers?.host} xfHost=${req?.headers?.['x-forwarded-host']} xfProto=${req?.headers?.['x-forwarded-proto']} req.secure=${String(req?.secure)} isSecure=${String(isSecure)} isProduction=${String(isProduction)} set-cookie=${JSON.stringify(this.getSanitizedSetCookieHeader(res))}`
      );

      this.logger.log(`Google authentication successful, isNewUser: ${result.isNewUser}, redirecting to callback page: ${result.redirectUrl}`);
      res.redirect(result.redirectUrl);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      const errorMessage =
        error instanceof OAuthAuthorizationCodeMissingError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Authentication failed';
      this.logger.error('Google OAuth callback error', errorStack);
      res.redirect(this.completeOAuthCallbackUseCase.buildLoginErrorRedirectUrl(errorMessage));
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
      const returnTo = req.query.returnTo;
      const { authUrl, returnTo: resolvedReturnTo } = this.initiateOAuthUseCase.initiateYandex(returnTo);
      this.logger.log(`Redirecting to Yandex OAuth with return_url: ${resolvedReturnTo}`);
      res.redirect(authUrl);
    } catch (error) {
      if (error instanceof OAuthDisabledError || error instanceof OAuthNotConfiguredError) {
        this.logger.error(error.message);
      }
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

      const result = await this.completeOAuthCallbackUseCase.completeYandexCallback({
        code: req.query.code,
        response: res,
        request: req,
      });

      const isSecure = this.cookieManager.isRequestSecure(req);
      const isProduction = this.cookieManager.resolveIsProduction(req);
      this.logger.debug(
        `[cookie-debug] yandex callback host=${req?.headers?.host} xfHost=${req?.headers?.['x-forwarded-host']} xfProto=${req?.headers?.['x-forwarded-proto']} req.secure=${String(req?.secure)} isSecure=${String(isSecure)} isProduction=${String(isProduction)} set-cookie=${JSON.stringify(this.getSanitizedSetCookieHeader(res))}`
      );

      this.logger.log(`Yandex authentication successful, isNewUser: ${result.isNewUser}, redirecting to callback page: ${result.redirectUrl}`);
      res.redirect(result.redirectUrl);
    } catch (error) {
      const errorStack = error instanceof Error ? error.stack : String(error);
      const errorMessage =
        error instanceof OAuthAuthorizationCodeMissingError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Authentication failed';
      this.logger.error('Yandex OAuth callback error', errorStack);
      res.redirect(this.completeOAuthCallbackUseCase.buildLoginErrorRedirectUrl(errorMessage));
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
      const result = await this.registerPasskeyUseCase.startRegistration(body);
      // Return raw JSON without wrapper (required by @simplewebauthn/browser)
      return res.json(result);
    } catch (error) {
      if (error instanceof PasskeyAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      if (error instanceof PasskeyRegistrationIdentityRequiredError) {
        throw new InternalServerError('Failed to generate passkey options');
      }
      this.logger.error('Passkey reg options error', error);
      throw new InternalServerError('Failed to generate passkey options');
    }
  }

  @Post('passkey/register/finish')
  async verifyPasskeyRegistration(@Body() body: any, @Res() res: any, @Req() req: any) {
    try {
      const result = await this.registerPasskeyUseCase.finishRegistration({
        body,
        request: req,
        response: res,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      if (error instanceof PasskeyAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      this.logger.error('Passkey reg verify error', error);
      throw new InternalServerError('Failed to verify passkey registration');
    }
  }

  @Post('passkey/login/start')
  async generatePasskeyLoginOptions(@Body() body: { username?: string }) {
    try {
      return await this.authenticatePasskeyUseCase.startLogin(body);
    } catch (error) {
      if (error instanceof PasskeyAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      this.logger.error('Passkey login options error', error);
      throw new InternalServerError('Failed to generate passkey login options');
    }
  }

  @Post('passkey/login/finish')
  async verifyPasskeyLogin(@Body() body: any, @Res() res: any, @Req() req: any) {
    try {
      const result = await this.authenticatePasskeyUseCase.finishLogin({
        body,
        request: req,
        response: res,
      });

      return res.json({ success: true, user: result.user });
    } catch (error) {
      if (error instanceof PasskeyAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      this.logger.error('Passkey login verify error', error);
      throw new InternalServerError('Failed to verify passkey login');
    }
  }

  /**
   * Unified Passkey Authentication Start (combines login + registration)
   */
  @Post('passkey/authenticate/start')
  async generatePasskeyAuthenticationOptions(@Res() res: any) {
    try {
      const result = await this.authenticatePasskeyUseCase.startAuthentication();
      // Return raw JSON without wrapper (required by @simplewebauthn/browser)
      return res.json(result);
    } catch (error) {
      if (error instanceof PasskeyAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      this.logger.error('Passkey authentication options error', error);
      throw new InternalServerError('Failed to generate passkey authentication options');
    }
  }

  /**
   * Unified Passkey Authentication (combines login + registration)
   */
  @Post('passkey/authenticate/finish')
  async authenticateWithPasskey(@Body() body: any, @Res() res: any, @Req() req: any) {
    try {
      const result = await this.authenticatePasskeyUseCase.finishAuthentication({
        body,
        request: req,
        response: res,
      });

      return res.json({
        success: true,
        user: result.user,
        isNewUser: result.isNewUser,
      });
    } catch (error) {
      if (error instanceof PasskeyAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
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
      this.logger.log(`SMS OTP send request for ${body.phoneNumber}`);
      const result = await this.sendSmsOtpUseCase.send(body.phoneNumber);
      this.logger.log(`OTP sent successfully to ${body.phoneNumber}`);

      return res.json({
        success: true,
        expiresIn: result.expiresIn,
        canResendAt: result.canResendAt,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof SmsAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      const errorMessage =
        error instanceof PhoneNumberRequiredError ||
        error instanceof InvalidPhoneNumberError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to send SMS';
      this.logger.error(`SMS send error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }

  @Post('sms/verify')
  async verifySmsOtp(@Body() body: { phoneNumber: string; otpCode: string }, @Req() req: any, @Res() res: any) {
    try {
      this.logger.log(`SMS OTP verify request for ${body.phoneNumber}`);

      const result = await this.verifySmsOtpUseCase.verify({
        phoneNumber: body.phoneNumber,
        otpCode: body.otpCode,
        request: req,
        response: res,
      });

      this.logger.log(`SMS authentication successful for ${body.phoneNumber}, isNewUser: ${result.isNewUser}`);

      return res.json({
        success: true,
        user: result.user,
        isNewUser: result.isNewUser,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof SmsAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      const errorMessage =
        error instanceof OtpCodeRequiredError ||
        error instanceof PhoneNumberRequiredError ||
        error instanceof InvalidPhoneNumberError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to verify SMS';
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
    const appUrl = this.configService.get('app')?.url ?? 'http://localhost';
    const loginUrl = `${appUrl}/meriter/login?error=link_expired`;

    if (this.isMagicLinkRedeemRateLimited(req)) {
      this.logger.warn('Magic link redeem rate limit exceeded');
      return res.redirect(302, loginUrl);
    }

    try {
      const result = await this.redeemMagicLinkUseCase.redeem({
        token,
        request: req,
        response: res,
      });
      if (!result) {
        return res.redirect(302, loginUrl);
      }

      this.logger.log(`Magic link auth successful for ${result.channel}`);
      const destination = result.isNewUser
        ? `${appUrl}/meriter/welcome`
        : `${appUrl}/meriter/profile`;
      return res.redirect(302, destination);
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
      const result = await this.verifyCallCheckUseCase.verifyStatus({
        checkId: body.checkId,
        phoneNumber: body.phoneNumber,
        request: req,
        response: res,
      });

      if (result.status === 'CONFIRMED') {
        return res.json({
          success: true,
          status: 'CONFIRMED',
          user: result.user,
          isNewUser: result.isNewUser,
        });
      }

      return res.json({
        success: true,
        status: result.status,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof CallAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      const errorMessage =
        error instanceof CallCheckParamsRequiredError ||
        error instanceof PhoneNumberRequiredError ||
        error instanceof InvalidPhoneNumberError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to check call status';
      this.logger.error(`Call check status error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }

  // --- Email Authentication Endpoints ---

  /**
   * Send a one-time login link to the given email address.
   * Login completes when the user opens the link (GET /api/v1/auth/link/:token).
   */
  @Post('email/send')
  async sendEmailLoginLink(@Body() body: { email: string }, @Res() res: any) {
    try {
      this.logger.log(`Email login link send request for ${body.email}`);
      const result = await this.sendEmailLoginLinkUseCase.send(body.email);

      return res.json({
        success: true,
        expiresIn: result.expiresIn,
        canResendAt: result.canResendAt,
      });
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof EmailAuthDisabledError) {
        throw new ForbiddenException(error.message);
      }
      const errorMessage =
        error instanceof EmailRequiredError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to send Email';
      this.logger.error(`Email send error: ${errorMessage}`, error);
      throw new InternalServerError(errorMessage);
    }
  }
}
