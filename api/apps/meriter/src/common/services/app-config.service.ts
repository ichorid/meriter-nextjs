import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

/**
 * Application Configuration Service
 * 
 * Provides typed, domain-organized access to application configuration.
 * This service wraps ConfigService<AppConfig> and provides convenient
 * getter methods organized by configuration domain.
 * 
 * Benefits:
 * - Single source of truth for config access patterns
 * - Easier to mock in tests
 * - Better encapsulation
 * - Consistent error handling with getOrThrow for required values
 * - Type-safe access to all configuration
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  // ============================================================================
  // Core Application Configuration
  // ============================================================================

  /**
   * Get application base URL
   * @returns Application URL (e.g., 'http://localhost' or 'https://meriter.pro')
   */
  getAppUrl(): string {
    return (this.configService.getOrThrow as any)('app.url') as string;
  }

  /**
   * Get application port
   * @returns Server port number (default: 8002)
   */
  getAppPort(): number {
    return ((this.configService.get as any)('app.port') ?? 8002) as number;
  }

  /**
   * Get node environment
   * @returns Node environment ('development' | 'production' | 'test')
   */
  getNodeEnv(): 'development' | 'production' | 'test' {
    return ((this.configService.get as any)('app.env') ?? 'development') as 'development' | 'production' | 'test';
  }

  /**
   * Check if running in production
   * @returns true if NODE_ENV is 'production'
   */
  isProduction(): boolean {
    return this.getNodeEnv() === 'production';
  }

  /**
   * Get application domain
   * @returns Domain string (from DOMAIN env var)
   */
  getDomain(): string | undefined {
    return this.configService.get('DOMAIN');
  }

  // ============================================================================
  // JWT Configuration
  // ============================================================================

  /**
   * Get JWT secret (required)
   * @returns JWT signing secret
   * @throws Error if JWT_SECRET is not configured
   */
  getJwtSecret(): string {
    return (this.configService.getOrThrow as any)('jwt.secret') as string;
  }

  // ============================================================================
  // Bot Configuration
  // ============================================================================

  /**
   * Get bot username
   * @returns Bot username (default: 'meriterbot')
   */
  getBotUsername(): string {
    return ((this.configService.get as any)('bot.username') ?? 'meriterbot') as string;
  }

  /**
   * Get bot token
   * @returns Bot token (optional)
   */
  getBotToken(): string {
    return ((this.configService.get as any)('bot.token') ?? '') as string;
  }

  // ============================================================================
  // Database Configuration
  // ============================================================================

  /**
   * Get primary MongoDB URL
   * @returns MongoDB connection string
   */
  getMongoUrl(): string {
    return (this.configService.getOrThrow as any)('database.mongoUrl') as string;
  }

  /**
   * Get secondary MongoDB URL
   * @returns Secondary MongoDB connection string
   */
  getMongoUrlSecondary(): string {
    return (this.configService.getOrThrow as any)('database.mongoUrlSecondary') as string;
  }

  // ============================================================================
  // OAuth Configuration
  // ============================================================================

  /**
   * Check if Google OAuth is enabled
   * @returns true if OAUTH_GOOGLE_ENABLED is 'true'
   */
  isGoogleOAuthEnabled(): boolean {
    return ((this.configService.get as any)('oauth.google.enabled') ?? false) as boolean;
  }

  /**
   * Get Google OAuth configuration
   * @returns Google OAuth config object
   * @throws Error if Google OAuth is enabled but credentials are missing
   */
  getGoogleOAuthConfig(): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    if (!this.isGoogleOAuthEnabled()) {
      throw new Error('Google OAuth is not enabled');
    }

    const clientId = (this.configService.get as any)('oauth.google.clientId') as string | undefined;
    const clientSecret = (this.configService.get as any)('oauth.google.clientSecret') as string | undefined;
    const redirectUri = 
      ((this.configService.get as any)('oauth.google.redirectUri') as string | undefined) ||
      (this.configService.get('GOOGLE_REDIRECT_URI') as string | undefined);

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Google OAuth credentials not configured. Set OAUTH_GOOGLE_CLIENT_ID, OAUTH_GOOGLE_CLIENT_SECRET, and OAUTH_GOOGLE_REDIRECT_URI');
    }

    return { clientId, clientSecret, redirectUri };
  }

  /**
   * Check if Yandex OAuth is enabled
   * @returns true if OAUTH_YANDEX_ENABLED is 'true'
   */
  isYandexOAuthEnabled(): boolean {
    return ((this.configService.get as any)('oauth.yandex.enabled') ?? false) as boolean;
  }

  /**
   * Get Yandex OAuth configuration
   * @returns Yandex OAuth config object
   * @throws Error if Yandex OAuth is enabled but credentials are missing
   */
  getYandexOAuthConfig(): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    if (!this.isYandexOAuthEnabled()) {
      throw new Error('Yandex OAuth is not enabled');
    }

    const clientId = (this.configService.get as any)('oauth.yandex.clientId') as string | undefined;
    const clientSecret = (this.configService.get as any)('oauth.yandex.clientSecret') as string | undefined;
    const redirectUri = (this.configService.get as any)('oauth.yandex.redirectUri') as string | undefined;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Yandex OAuth credentials not configured. Set OAUTH_YANDEX_CLIENT_ID, OAUTH_YANDEX_CLIENT_SECRET, and OAUTH_YANDEX_REDIRECT_URI');
    }

    return { clientId, clientSecret, redirectUri };
  }

  /**
   * Check if any OAuth provider is enabled
   * @returns true if at least one OAuth provider is enabled
   */
  isAnyOAuthEnabled(): boolean {
    return (
      this.isGoogleOAuthEnabled() ||
      this.isYandexOAuthEnabled() ||
      ((this.configService.get as any)('oauth.vk.enabled') ?? false) ||
      ((this.configService.get as any)('oauth.telegram.enabled') ?? false) ||
      ((this.configService.get as any)('oauth.apple.enabled') ?? false) ||
      ((this.configService.get as any)('oauth.twitter.enabled') ?? false) ||
      ((this.configService.get as any)('oauth.instagram.enabled') ?? false) ||
      ((this.configService.get as any)('oauth.sber.enabled') ?? false) ||
      ((this.configService.get as any)('oauth.mailru.enabled') ?? false)
    );
  }

  // ============================================================================
  // WebAuthn/Passkey Configuration
  // ============================================================================

  /**
   * Check if WebAuthn/Passkey authentication is enabled
   * @returns true if AUTHN_ENABLED is 'true'
   */
  isAuthnEnabled(): boolean {
    return ((this.configService.get as any)('authn.enabled') ?? false) as boolean;
  }

  /**
   * Get WebAuthn configuration
   * @returns WebAuthn config object with RP settings
   */
  getAuthnConfig(): {
    rpId: string;
    rpOrigin: string;
    rpName: string;
  } {
    const rpId = ((this.configService.get as any)('authn.rpId') ?? 'localhost') as string;
    const rpOrigin = 
      ((this.configService.get as any)('authn.rpOrigin') as string | undefined) ||
      (this.configService.get('APP_URL') as string | undefined) ||
      'http://localhost:3000';
    const rpName = ((this.configService.get as any)('authn.rpName') ?? 'Meriter') as string;

    return { rpId, rpOrigin, rpName };
  }

  // ============================================================================
  // Storage Configuration
  // ============================================================================

  /**
   * Check if S3 storage is configured
   * @returns true if all S3 credentials are present
   */
  isS3Configured(): boolean {
    const endpoint = (this.configService.get as any)('storage.s3.endpoint') as string | undefined;
    const bucketName = (this.configService.get as any)('storage.s3.bucketName') as string | undefined;
    const accessKeyId = (this.configService.get as any)('storage.s3.accessKeyId') as string | undefined;
    const secretAccessKey = (this.configService.get as any)('storage.s3.secretAccessKey') as string | undefined;
    return !!(endpoint && bucketName && accessKeyId && secretAccessKey);
  }

  /**
   * Get S3 storage configuration
   * @returns S3 config object
   * @throws Error if S3 is not configured
   */
  getS3Config(): {
    endpoint: string;
    bucketName: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  } {
    if (!this.isS3Configured()) {
      throw new Error('S3 storage is not configured');
    }

    return {
      endpoint: (this.configService.getOrThrow as any)('storage.s3.endpoint') as string,
      bucketName: (this.configService.getOrThrow as any)('storage.s3.bucketName') as string,
      accessKeyId: (this.configService.getOrThrow as any)('storage.s3.accessKeyId') as string,
      secretAccessKey: (this.configService.getOrThrow as any)('storage.s3.secretAccessKey') as string,
      region: ((this.configService.get as any)('storage.s3.region') ?? 'us-east-1') as string,
    };
  }

  // ============================================================================
  // Telegram Configuration
  // ============================================================================

  /**
   * Get Telegram API URL
   * @returns Telegram API URL (default: 'https://api.telegram.org')
   */
  getTelegramApiUrl(): string {
    return ((this.configService.get as any)('telegram.apiUrl') ?? 'https://api.telegram.org') as string;
  }

  /**
   * Get Telegram avatar base URL
   * @returns Avatar base URL (default: 'https://telegram.hb.bizmrg.com/telegram_small_avatars')
   */
  getTelegramAvatarBaseUrl(): string {
    return ((this.configService.get as any)('telegram.avatarBaseUrl') ?? 'https://telegram.hb.bizmrg.com/telegram_small_avatars') as string;
  }

  /**
   * Get Dicebear API URL
   * @returns Dicebear API URL (default: 'https://avatars.dicebear.com/api/jdenticon')
   */
  getDicebearApiUrl(): string {
    return ((this.configService.get as any)('telegram.dicebearApiUrl') ?? 'https://avatars.dicebear.com/api/jdenticon') as string;
  }

  // ============================================================================
  // Feature Flags
  // ============================================================================

  /**
   * Check if a feature is enabled
   * @param feature - Feature name (e.g., 'analytics', 'debug', 'commentVoting')
   * @returns true if feature is enabled
   */
  isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return ((this.configService.get as any)(`features.${feature}`) ?? false) as boolean;
  }

  /**
   * Check if comment image uploads are enabled
   * @returns true if ENABLE_COMMENT_IMAGE_UPLOADS or NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS is 'true'
   */
  isCommentImageUploadsEnabled(): boolean {
    return ((this.configService.get as any)('features.commentImageUploadsEnabled') ?? false) as boolean;
  }

  // ============================================================================
  // Development Configuration
  // ============================================================================

  /**
   * Check if fake data mode is enabled
   * @returns true if FAKE_DATA_MODE is 'true'
   */
  isFakeDataMode(): boolean {
    return ((this.configService.get as any)('dev.fakeDataMode') ?? false) as boolean;
  }
}

