/**
 * Application Configuration Interface
 * 
 * This interface defines the complete structure of application configuration,
 * including all environment variables organized by domain.
 * 
 * @see https://docs.nestjs.com/techniques/configuration
 */

/**
 * OAuth Provider Configuration
 */
export interface OAuthProviderConfig {
  /** Whether this OAuth provider is enabled (from OAUTH_*_ENABLED env var) */
  enabled: boolean;
  /** OAuth client ID (from OAUTH_*_CLIENT_ID env var) */
  clientId?: string;
  /** OAuth client secret (from OAUTH_*_CLIENT_SECRET env var) */
  clientSecret?: string;
  /** OAuth redirect URI (from OAUTH_*_REDIRECT_URI or OAUTH_*_CALLBACK_URL env var) */
  redirectUri?: string;
}

/**
 * OAuth Configuration
 * Supports multiple OAuth providers: Google, Yandex, VK, Telegram, Apple, Twitter, Instagram, Sber, Mailru
 */
export interface OAuthConfig {
  google: OAuthProviderConfig;
  yandex: OAuthProviderConfig;
  vk: OAuthProviderConfig;
  telegram: OAuthProviderConfig;
  apple: OAuthProviderConfig;
  twitter: OAuthProviderConfig;
  instagram: OAuthProviderConfig;
  sber: OAuthProviderConfig;
  mailru: OAuthProviderConfig;
}

/**
 * WebAuthn/Passkey Configuration
 */
export interface AuthnConfig {
  /** Whether WebAuthn/Passkey authentication is enabled (from AUTHN_ENABLED env var) */
  enabled: boolean;
  /** Relying Party ID (from RP_ID env var, default: 'localhost') */
  rpId?: string;
  /** Relying Party Origin (from RP_ORIGIN or APP_URL env var) */
  rpOrigin?: string;
  /** Relying Party Name (from RP_NAME env var, default: 'Meriter') */
  rpName?: string;
}

/**
 * SMS Authentication Configuration
 */
export interface SmsConfig {
  /** Whether SMS authentication is enabled (from SMS_ENABLED env var) */
  enabled: boolean;
  /** SMS provider (from SMS_PROVIDER env var, default: 'smsru') */
  provider: string;
  /** SMS API URL (from SMS_API_URL env var, provider-specific) */
  apiUrl?: string;
  /** SMS API ID/Key (from SMS_API_ID env var, provider-specific) */
  apiId?: string;
  /** SMS sender name (from SMS_FROM env var, default: 'Meriter') */
  from?: string;
  /** SMS test mode (from SMS_TEST_MODE env var or auto-enabled in dev) */
  testMode?: boolean;
  /** OTP code length (default: 6) */
  otpLength: number;
  /** OTP expiry time in minutes (default: 5) */
  otpExpiryMinutes: number;
  /** Maximum verification attempts per OTP (default: 3) */
  maxAttemptsPerOtp: number;
  /** Rate limit: max SMS per hour per phone (default: 3) */
  rateLimitPerHour: number;
  /** Resend cooldown in seconds (default: 60) */
  resendCooldownSeconds: number;
}

/**
 * Phone Call Authentication Configuration
 */
export interface PhoneConfig {
  /** Whether Call Check authentication is enabled (from PHONE_ENABLED env var) */
  enabled: boolean;
}

/**
 * Email Authentication Configuration
 */
export interface EmailConfig {
  /** Whether Email authentication is enabled (from EMAIL_ENABLED env var) */
  enabled: boolean;
  /** SMTP Server Configuration */
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
  };
}

/**
 * S3 Storage Configuration
 */
export interface S3Config {
  /** S3 endpoint URL (from S3_ENDPOINT env var) */
  endpoint?: string;
  /** S3 bucket name (from S3_BUCKET_NAME env var) */
  bucketName?: string;
  /** S3 access key ID (from S3_ACCESS_KEY_ID env var) */
  accessKeyId?: string;
  /** S3 secret access key (from S3_SECRET_ACCESS_KEY env var) */
  secretAccessKey?: string;
  /** S3 region (from S3_REGION env var, default: 'us-east-1') */
  region?: string;
}

/**
 * Storage Configuration
 */
export interface StorageConfig {
  s3: S3Config;
}

/**
 * Telegram Configuration
 */
export interface TelegramConfig {
  /** Telegram API URL (from TELEGRAM_API_URL env var, default: 'https://api.telegram.org') */
  apiUrl: string;
  /** Telegram avatar base URL (from TELEGRAM_AVATAR_BASE_URL env var) */
  avatarBaseUrl?: string;
  /** Dicebear API URL for avatar generation (from DICEBEAR_API_URL env var) */
  dicebearApiUrl?: string;
}

/**
 * Feature Flags Configuration
 */
export interface FeatureFlagsConfig {
  /** Telegram bot enabled (from TELEGRAM_BOT_ENABLED env var) */
  telegramBotEnabled: boolean;
  /** Telegram OAuth enabled (from OAUTH_TELEGRAM_ENABLED env var) */
  telegramAuthEnabled: boolean;
  /** Comment image uploads enabled (from ENABLE_COMMENT_IMAGE_UPLOADS or NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS env var) */
  commentImageUploadsEnabled: boolean;
  /** Analytics enabled (from ENABLE_ANALYTICS or NEXT_PUBLIC_ENABLE_ANALYTICS env var) */
  analytics?: boolean;
  /** Debug mode enabled (from ENABLE_DEBUG or NEXT_PUBLIC_ENABLE_DEBUG env var) */
  debug?: boolean;
  /** Comment voting enabled (from ENABLE_COMMENT_VOTING or NEXT_PUBLIC_ENABLE_COMMENT_VOTING env var) */
  commentVoting?: boolean;
  /** Login invite form enabled (from ENABLE_LOGIN_INVITE_FORM or NEXT_PUBLIC_ENABLE_LOGIN_INVITE_FORM env var) */
  loginInviteForm?: boolean;
}

/**
 * Development Configuration
 */
export interface DevConfig {
  /** Fake data mode enabled (from FAKE_DATA_MODE env var) */
  fakeDataMode: boolean;
  /** Test auth mode enabled (from TEST_AUTH_MODE env var) */
  testAuthMode: boolean;
}

/**
 * Application Configuration
 * 
 * Complete configuration structure for the Meriter application.
 * All environment variables are mapped to typed properties organized by domain.
 * 
 * @property app - Application core settings (URL, port, environment)
 * @property jwt - JWT authentication settings
 * @property bot - Telegram bot settings
 * @property database - Database connection settings
 * @property oauth - OAuth provider configurations
 * @property authn - WebAuthn/Passkey authentication settings
 * @property storage - Storage service configurations (S3)
 * @property telegram - Telegram-specific settings
 * @property features - Feature flags
 * @property dev - Development mode settings
 * 
 * Flat environment variables (for backward compatibility):
 * - NODE_ENV: 'development' | 'production' | 'test'
 * - DOMAIN: Application domain (required)
 * - APP_URL: Application URL (optional, derived from DOMAIN if not set)
 */
export interface AppConfig {
  /** Application core settings */
  app: {
    /** Application base URL (derived from DOMAIN env var) */
    url: string;
    /** Server port (from PORT env var, default: 8002) */
    port: number;
    /** Node environment (from NODE_ENV env var, default: 'development') */
    env: 'development' | 'production' | 'test';
  };

  /** JWT authentication settings */
  jwt: {
    /** JWT signing secret (from JWT_SECRET env var, required in production) */
    secret: string;
  };

  /** Telegram bot settings */
  bot: {
    /** Bot username (from BOT_USERNAME env var, default: 'meriterbot') */
    username: string;
    /** Bot token (from BOT_TOKEN env var) */
    token: string;
  };

  /** Database connection settings */
  database: {
    /** Primary MongoDB connection URL (from MONGO_URL env var) */
    mongoUrl: string;
    /** Secondary MongoDB connection URL (from MONGO_URL_SECONDARY env var) */
    mongoUrlSecondary: string;
  };

  /** OAuth provider configurations */
  oauth: OAuthConfig;

  /** WebAuthn/Passkey authentication settings */
  authn: AuthnConfig;

  /** SMS authentication settings */
  sms: SmsConfig;

  /** Phone Call authentication settings */
  phone: PhoneConfig;

  /** Email authentication settings */
  email: EmailConfig;

  /** Storage service configurations */
  storage: StorageConfig;

  /** Telegram-specific settings */
  telegram: TelegramConfig;

  /** Feature flags */
  features: FeatureFlagsConfig;

  /** Development mode settings */
  dev: DevConfig;

  // Flat environment variables (for backward compatibility and direct access)
  /** Node environment (from NODE_ENV env var) */
  NODE_ENV?: 'development' | 'production' | 'test';
  /** Application domain (from DOMAIN env var, required) */
  DOMAIN?: string;
  /** Application URL (from APP_URL env var, optional) */
  APP_URL?: string;
  /** Google OAuth redirect URI (legacy env var, optional) */
  GOOGLE_REDIRECT_URI?: string;
}

/**
 * Derive application URL from DOMAIN
 * Protocol: http:// for localhost, https:// for production
 * Falls back to APP_URL for backward compatibility if DOMAIN is not set
 * REQUIRES: DOMAIN environment variable must be set (validated by validation schema)
 * Exception: In test environment, defaults to localhost for testing
 */
function deriveAppUrl(): string {
  const domain = process.env.DOMAIN;
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!domain) {
    // Backward compatibility: if APP_URL exists but DOMAIN doesn't, use APP_URL
    // However, this should not happen as validation schema requires DOMAIN
    if (process.env.APP_URL) {
      return process.env.APP_URL;
    }

    // Allow default for test and development environments
    if (nodeEnv === 'test' || nodeEnv === 'development') {
      return 'http://localhost';
    }

    throw new Error(
      'DOMAIN environment variable is required. Set DOMAIN to your domain (e.g., dev.meriter.pro, stage.meriter.pro, or meriter.pro).\n' +
      'For local development, you can set DOMAIN=localhost or leave it unset (defaults to http://localhost).'
    );
  }

  // Use http:// for localhost, https:// for production
  const protocol = domain === 'localhost' ? 'http://' : 'https://';
  return `${protocol}${domain}`;
}

/**
 * Create OAuth provider configuration from environment variables
 */
function createOAuthProviderConfig(
  providerName: string,
  env: Record<string, string | undefined>
): OAuthProviderConfig {
  const enabled = env[`OAUTH_${providerName.toUpperCase()}_ENABLED`] === 'true';
  const clientId = env[`OAUTH_${providerName.toUpperCase()}_CLIENT_ID`];
  const clientSecret = env[`OAUTH_${providerName.toUpperCase()}_CLIENT_SECRET`];
  const redirectUri =
    env[`OAUTH_${providerName.toUpperCase()}_REDIRECT_URI`] ||
    env[`OAUTH_${providerName.toUpperCase()}_CALLBACK_URL`] ||
    (providerName === 'google' ? env.GOOGLE_REDIRECT_URI : undefined);

  return {
    enabled,
    clientId,
    clientSecret,
    redirectUri,
  };
}

/**
 * Configuration factory function
 * 
 * Loads and structures all environment variables into the AppConfig interface.
 * This function is called by NestJS ConfigModule during application bootstrap.
 * 
 * @returns Complete application configuration object
 */
export default (): AppConfig => {
  const env = process.env;
  const nodeEnv = (env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const fakeDataMode = env.FAKE_DATA_MODE === 'true';
  const testAuthMode = env.TEST_AUTH_MODE === 'true';

  return {
    app: {
      url: deriveAppUrl(),
      port: parseInt(env.PORT || '8002', 10) || 8002,
      env: nodeEnv,
    },
    jwt: {
      secret: env.JWT_SECRET || (fakeDataMode ? 'fake-dev-secret' : ''),
    },
    bot: {
      username: env.BOT_USERNAME || 'meriterbot',
      token: env.BOT_TOKEN || '',
    },
    database: {
      mongoUrl: env.MONGO_URL || 'mongodb://127.0.0.1:27017/meriter',
      mongoUrlSecondary: env.MONGO_URL_SECONDARY || 'mongodb://127.0.0.1:27017/meriter_test',
    },
    oauth: {
      google: createOAuthProviderConfig('google', env),
      yandex: createOAuthProviderConfig('yandex', env),
      vk: createOAuthProviderConfig('vk', env),
      telegram: createOAuthProviderConfig('telegram', env),
      apple: createOAuthProviderConfig('apple', env),
      twitter: createOAuthProviderConfig('twitter', env),
      instagram: createOAuthProviderConfig('instagram', env),
      sber: createOAuthProviderConfig('sber', env),
      mailru: createOAuthProviderConfig('mailru', env),
    },
    authn: {
      enabled: env.AUTHN_ENABLED === 'true',
      rpId: env.RP_ID,
      rpOrigin: env.RP_ORIGIN || env.APP_URL,
      rpName: env.RP_NAME,
    },
    sms: {
      enabled: env.SMS_ENABLED === 'true',
      provider: env.SMS_PROVIDER || 'smsru',
      apiUrl: env.SMS_API_URL || 'https://sms.ru/sms',
      apiId: env.SMS_API_ID,
      from: env.SMS_FROM || 'Meriter',
      testMode: env.SMS_TEST_MODE === 'true' || nodeEnv !== 'production',
      otpLength: 6,
      otpExpiryMinutes: 5,
      maxAttemptsPerOtp: 3,
      rateLimitPerHour: 3,
      resendCooldownSeconds: 60,
    },
    phone: {
      enabled: env.PHONE_ENABLED === 'true',
    },
    email: {
      enabled: env.EMAIL_ENABLED === 'true',
      smtp: {
        host: env.EMAIL_SMTP_HOST || '',
        port: parseInt(env.EMAIL_SMTP_PORT || '587', 10),
        user: env.EMAIL_SMTP_USERNAME || '',
        pass: env.EMAIL_SMTP_PASSWORD || '',
        secure: env.EMAIL_SMTP_IS_SECURE === 'true',
      },
    },
    storage: {
      s3: {
        endpoint: env.S3_ENDPOINT,
        bucketName: env.S3_BUCKET_NAME,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        region: env.S3_REGION,
      },
    },
    telegram: {
      apiUrl: env.TELEGRAM_API_URL || 'https://api.telegram.org',
      avatarBaseUrl: env.TELEGRAM_AVATAR_BASE_URL,
      dicebearApiUrl: env.DICEBEAR_API_URL,
    },
    features: {
      telegramBotEnabled: env.TELEGRAM_BOT_ENABLED === 'true',
      telegramAuthEnabled: env.OAUTH_TELEGRAM_ENABLED === 'true',
      commentImageUploadsEnabled:
        env.ENABLE_COMMENT_IMAGE_UPLOADS === 'true' ||
        env.NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS === 'true',
      analytics:
        env.ENABLE_ANALYTICS === 'true' ||
        env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
      debug:
        env.ENABLE_DEBUG === 'true' ||
        env.NEXT_PUBLIC_ENABLE_DEBUG === 'true',
      commentVoting:
        env.ENABLE_COMMENT_VOTING === 'true' ||
        env.NEXT_PUBLIC_ENABLE_COMMENT_VOTING === 'true',
      loginInviteForm:
        env.ENABLE_LOGIN_INVITE_FORM === 'true' ||
        env.NEXT_PUBLIC_ENABLE_LOGIN_INVITE_FORM === 'true',
    },
    dev: {
      fakeDataMode,
      testAuthMode,
    },
    // Flat env vars for backward compatibility
    NODE_ENV: nodeEnv,
    DOMAIN: env.DOMAIN,
    APP_URL: env.APP_URL,
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
  };
};
