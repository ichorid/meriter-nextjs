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
    return this.configService.getOrThrow('app.url');
  }

  /**
   * Get application port
   * @returns Server port number (default: 8002)
   */
  getAppPort(): number {
    return this.configService.get('app.port', 8002);
  }

  /**
   * Get node environment
   * @returns Node environment ('development' | 'production' | 'test')
   */
  getNodeEnv(): 'development' | 'production' | 'test' {
    return this.configService.get('app.env', 'development');
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
    return this.configService.getOrThrow('jwt.secret');
  }

  // ============================================================================
  // Bot Configuration
  // ============================================================================

  /**
   * Get bot username
   * @returns Bot username (default: 'meriterbot')
   */
  getBotUsername(): string {
    return this.configService.get('bot.username', 'meriterbot');
  }

  /**
   * Get bot token
   * @returns Bot token (optional)
   */
  getBotToken(): string {
    return this.configService.get('bot.token', '');
  }

  // ============================================================================
  // Database Configuration
  // ============================================================================

  /**
   * Get primary MongoDB URL
   * @returns MongoDB connection string
   */
  getMongoUrl(): string {
    return this.configService.getOrThrow('database.mongoUrl');
  }

  /**
   * Get secondary MongoDB URL
   * @returns Secondary MongoDB connection string
   */
  getMongoUrlSecondary(): string {
    return this.configService.getOrThrow('database.mongoUrlSecondary');
  }

  // ============================================================================
  // OAuth Configuration
  // ============================================================================

  /**
   * Check if Google OAuth is enabled
   * @returns true if OAUTH_GOOGLE_ENABLED is 'true'
   */
  isGoogleOAuthEnabled(): boolean {
    return this.configService.get('oauth.google.enabled', false);
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

    const clientId = this.configService.get('oauth.google.clientId');
    const clientSecret = this.configService.get('oauth.google.clientSecret');
    const redirectUri = 
      this.configService.get('oauth.google.redirectUri') ||
      this.configService.get('GOOGLE_REDIRECT_URI');

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
    return this.configService.get('oauth.yandex.enabled', false);
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

    const clientId = this.configService.get('oauth.yandex.clientId');
    const clientSecret = this.configService.get('oauth.yandex.clientSecret');
    const redirectUri = this.configService.get('oauth.yandex.redirectUri');

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
      this.configService.get('oauth.vk.enabled', false) ||
      this.configService.get('oauth.telegram.enabled', false) ||
      this.configService.get('oauth.apple.enabled', false) ||
      this.configService.get('oauth.twitter.enabled', false) ||
      this.configService.get('oauth.instagram.enabled', false) ||
      this.configService.get('oauth.sber.enabled', false) ||
      this.configService.get('oauth.mailru.enabled', false)
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
    return this.configService.get('authn.enabled', false);
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
    const rpId = this.configService.get('authn.rpId', 'localhost');
    const rpOrigin = 
      this.configService.get('authn.rpOrigin') ||
      this.configService.get('APP_URL') ||
      'http://localhost:3000';
    const rpName = this.configService.get('authn.rpName', 'Meriter');

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
    const endpoint = this.configService.get('storage.s3.endpoint');
    const bucketName = this.configService.get('storage.s3.bucketName');
    const accessKeyId = this.configService.get('storage.s3.accessKeyId');
    const secretAccessKey = this.configService.get('storage.s3.secretAccessKey');
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
      endpoint: this.configService.getOrThrow('storage.s3.endpoint'),
      bucketName: this.configService.getOrThrow('storage.s3.bucketName'),
      accessKeyId: this.configService.getOrThrow('storage.s3.accessKeyId'),
      secretAccessKey: this.configService.getOrThrow('storage.s3.secretAccessKey'),
      region: this.configService.get('storage.s3.region', 'us-east-1'),
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
    return this.configService.get('telegram.apiUrl', 'https://api.telegram.org');
  }

  /**
   * Get Telegram avatar base URL
   * @returns Avatar base URL (default: 'https://telegram.hb.bizmrg.com/telegram_small_avatars')
   */
  getTelegramAvatarBaseUrl(): string {
    return this.configService.get(
      'telegram.avatarBaseUrl',
      'https://telegram.hb.bizmrg.com/telegram_small_avatars'
    );
  }

  /**
   * Get Dicebear API URL
   * @returns Dicebear API URL (default: 'https://avatars.dicebear.com/api/jdenticon')
   */
  getDicebearApiUrl(): string {
    return this.configService.get(
      'telegram.dicebearApiUrl',
      'https://avatars.dicebear.com/api/jdenticon'
    );
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
    return this.configService.get(`features.${feature}`, false);
  }

  /**
   * Check if comment image uploads are enabled
   * @returns true if ENABLE_COMMENT_IMAGE_UPLOADS or NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS is 'true'
   */
  isCommentImageUploadsEnabled(): boolean {
    return this.configService.get('features.commentImageUploadsEnabled', false);
  }

  // ============================================================================
  // Development Configuration
  // ============================================================================

  /**
   * Check if fake data mode is enabled
   * @returns true if FAKE_DATA_MODE is 'true'
   */
  isFakeDataMode(): boolean {
    return this.configService.get('dev.fakeDataMode', false);
  }
}

