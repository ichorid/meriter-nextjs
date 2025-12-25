import { z } from 'zod';

/**
 * Custom Joi-style wrapper for NestJS ConfigModule compatibility
 * ConfigModule expects a validationSchema with both validate and validateSync methods
 * 
 * This validation schema validates all environment variables used by the application,
 * ensuring type safety and format correctness.
 */
const validateSync = (config: Record<string, unknown>) => {
  const nodeEnv = (config.NODE_ENV as string) || 'development';
  const fakeDataMode = config.FAKE_DATA_MODE === 'true';
  
  // Validate DOMAIN is set - required for proper cookie domain scoping
  // Derive from APP_URL for backward compatibility if DOMAIN is not explicitly set
  // Exception: In test environment, defaults to localhost for testing
  let domain = config.DOMAIN as string;
  if (!domain) {
    if (config.APP_URL) {
      try {
        domain = new URL(config.APP_URL as string).hostname;
      } catch (_error) {
        throw new Error('DOMAIN is required. Either set DOMAIN environment variable or provide a valid APP_URL to derive it from.');
      }
    } else if (nodeEnv === 'test') {
      // Allow default for test environment only
      domain = 'localhost';
    } else {
      throw new Error('DOMAIN environment variable is required. Set DOMAIN to your domain (e.g., dev.meriter.pro, stage.meriter.pro, or meriter.pro).');
    }
  }
  
  // Apply defaults manually before validation
  const configWithDefaults = {
    DOMAIN: domain,
    PORT: config.PORT ? Number(config.PORT) : 8002,
    JWT_SECRET: (config.JWT_SECRET as string) || (fakeDataMode ? 'fake-dev-secret' : ''),
    BOT_USERNAME: (config.BOT_USERNAME as string) || '',
    BOT_TOKEN: (config.BOT_TOKEN as string) || '',
    MONGO_URL: (config.MONGO_URL as string) || 'mongodb://127.0.0.1:27017/meriter',
    MONGO_URL_SECONDARY: (config.MONGO_URL_SECONDARY as string) || 'mongodb://127.0.0.1:27017/meriter_test',
    NODE_ENV: nodeEnv,
    FAKE_DATA_MODE: config.FAKE_DATA_MODE || 'false',
    
    // Telegram
    TELEGRAM_BOT_ENABLED: (config.TELEGRAM_BOT_ENABLED as string) || 'false',
    OAUTH_TELEGRAM_ENABLED: (config.OAUTH_TELEGRAM_ENABLED as string) || 'false',
    TELEGRAM_API_URL: (config.TELEGRAM_API_URL as string) || 'https://api.telegram.org',
    TELEGRAM_AVATAR_BASE_URL: (config.TELEGRAM_AVATAR_BASE_URL as string) || undefined,
    DICEBEAR_API_URL: (config.DICEBEAR_API_URL as string) || undefined,
    
    // OAuth providers - enabled flags
    OAUTH_GOOGLE_ENABLED: (config.OAUTH_GOOGLE_ENABLED as string) || 'false',
    OAUTH_YANDEX_ENABLED: (config.OAUTH_YANDEX_ENABLED as string) || 'false',
    OAUTH_VK_ENABLED: (config.OAUTH_VK_ENABLED as string) || 'false',
    OAUTH_APPLE_ENABLED: (config.OAUTH_APPLE_ENABLED as string) || 'false',
    OAUTH_TWITTER_ENABLED: (config.OAUTH_TWITTER_ENABLED as string) || 'false',
    OAUTH_INSTAGRAM_ENABLED: (config.OAUTH_INSTAGRAM_ENABLED as string) || 'false',
    OAUTH_SBER_ENABLED: (config.OAUTH_SBER_ENABLED as string) || 'false',
    OAUTH_MAILRU_ENABLED: (config.OAUTH_MAILRU_ENABLED as string) || 'false',
    
    // OAuth providers - credentials (optional, validated if enabled)
    OAUTH_GOOGLE_CLIENT_ID: (config.OAUTH_GOOGLE_CLIENT_ID as string) || undefined,
    OAUTH_GOOGLE_CLIENT_SECRET: (config.OAUTH_GOOGLE_CLIENT_SECRET as string) || undefined,
    OAUTH_GOOGLE_REDIRECT_URI: (config.OAUTH_GOOGLE_REDIRECT_URI as string) || undefined,
    OAUTH_GOOGLE_CALLBACK_URL: (config.OAUTH_GOOGLE_CALLBACK_URL as string) || undefined,
    GOOGLE_REDIRECT_URI: (config.GOOGLE_REDIRECT_URI as string) || undefined,
    
    OAUTH_YANDEX_CLIENT_ID: (config.OAUTH_YANDEX_CLIENT_ID as string) || undefined,
    OAUTH_YANDEX_CLIENT_SECRET: (config.OAUTH_YANDEX_CLIENT_SECRET as string) || undefined,
    OAUTH_YANDEX_REDIRECT_URI: (config.OAUTH_YANDEX_REDIRECT_URI as string) || undefined,
    OAUTH_YANDEX_CALLBACK_URL: (config.OAUTH_YANDEX_CALLBACK_URL as string) || undefined,
    
    OAUTH_VK_CLIENT_ID: (config.OAUTH_VK_CLIENT_ID as string) || undefined,
    OAUTH_VK_CLIENT_SECRET: (config.OAUTH_VK_CLIENT_SECRET as string) || undefined,
    OAUTH_VK_REDIRECT_URI: (config.OAUTH_VK_REDIRECT_URI as string) || undefined,
    
    OAUTH_APPLE_CLIENT_ID: (config.OAUTH_APPLE_CLIENT_ID as string) || undefined,
    OAUTH_APPLE_CLIENT_SECRET: (config.OAUTH_APPLE_CLIENT_SECRET as string) || undefined,
    OAUTH_APPLE_REDIRECT_URI: (config.OAUTH_APPLE_REDIRECT_URI as string) || undefined,
    
    OAUTH_TWITTER_CLIENT_ID: (config.OAUTH_TWITTER_CLIENT_ID as string) || undefined,
    OAUTH_TWITTER_CLIENT_SECRET: (config.OAUTH_TWITTER_CLIENT_SECRET as string) || undefined,
    OAUTH_TWITTER_REDIRECT_URI: (config.OAUTH_TWITTER_REDIRECT_URI as string) || undefined,
    
    OAUTH_INSTAGRAM_CLIENT_ID: (config.OAUTH_INSTAGRAM_CLIENT_ID as string) || undefined,
    OAUTH_INSTAGRAM_CLIENT_SECRET: (config.OAUTH_INSTAGRAM_CLIENT_SECRET as string) || undefined,
    OAUTH_INSTAGRAM_REDIRECT_URI: (config.OAUTH_INSTAGRAM_REDIRECT_URI as string) || undefined,
    
    OAUTH_SBER_CLIENT_ID: (config.OAUTH_SBER_CLIENT_ID as string) || undefined,
    OAUTH_SBER_CLIENT_SECRET: (config.OAUTH_SBER_CLIENT_SECRET as string) || undefined,
    OAUTH_SBER_REDIRECT_URI: (config.OAUTH_SBER_REDIRECT_URI as string) || undefined,
    
    OAUTH_MAILRU_CLIENT_ID: (config.OAUTH_MAILRU_CLIENT_ID as string) || undefined,
    OAUTH_MAILRU_CLIENT_SECRET: (config.OAUTH_MAILRU_CLIENT_SECRET as string) || undefined,
    OAUTH_MAILRU_REDIRECT_URI: (config.OAUTH_MAILRU_REDIRECT_URI as string) || undefined,
    OAUTH_MAILRU_CALLBACK_URL: (config.OAUTH_MAILRU_CALLBACK_URL as string) || undefined,
    
    // WebAuthn
    AUTHN_ENABLED: (config.AUTHN_ENABLED as string) || 'false',
    RP_ID: (config.RP_ID as string) || undefined,
    RP_ORIGIN: (config.RP_ORIGIN as string) || undefined,
    RP_NAME: (config.RP_NAME as string) || undefined,
    
    // S3 Storage
    S3_ENDPOINT: (config.S3_ENDPOINT as string) || undefined,
    S3_BUCKET_NAME: (config.S3_BUCKET_NAME as string) || undefined,
    S3_ACCESS_KEY_ID: (config.S3_ACCESS_KEY_ID as string) || undefined,
    S3_SECRET_ACCESS_KEY: (config.S3_SECRET_ACCESS_KEY as string) || undefined,
    S3_REGION: (config.S3_REGION as string) || undefined,
    
    // Feature flags
    ENABLE_COMMENT_IMAGE_UPLOADS: (config.ENABLE_COMMENT_IMAGE_UPLOADS as string) || 'false',
    NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS: (config.NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS as string) || 'false',
    ENABLE_ANALYTICS: (config.ENABLE_ANALYTICS as string) || 'false',
    NEXT_PUBLIC_ENABLE_ANALYTICS: (config.NEXT_PUBLIC_ENABLE_ANALYTICS as string) || 'false',
    ENABLE_DEBUG: (config.ENABLE_DEBUG as string) || 'false',
    NEXT_PUBLIC_ENABLE_DEBUG: (config.NEXT_PUBLIC_ENABLE_DEBUG as string) || 'false',
    ENABLE_COMMENT_VOTING: (config.ENABLE_COMMENT_VOTING as string) || 'false',
    NEXT_PUBLIC_ENABLE_COMMENT_VOTING: (config.NEXT_PUBLIC_ENABLE_COMMENT_VOTING as string) || 'false',
    ENABLE_LOGIN_INVITE_FORM: (config.ENABLE_LOGIN_INVITE_FORM as string) || 'false',
    NEXT_PUBLIC_ENABLE_LOGIN_INVITE_FORM: (config.NEXT_PUBLIC_ENABLE_LOGIN_INVITE_FORM as string) || 'false',
    
    // App URL (optional, for backward compatibility)
    APP_URL: (config.APP_URL as string) || undefined,
  };

  // Helper function to validate URL format
  const urlValidator = z.string().url().optional().or(z.literal(''));
  
  // Helper function to validate AWS region format
  const awsRegionValidator = z.string().regex(/^[a-z0-9-]+$/).optional();
  
  // Helper function to validate MongoDB URI format
  const mongoUriValidator = z.string().regex(/^mongodb(\+srv)?:\/\//).optional();

  const envSchema = z.object({
    // Core required
    DOMAIN: z.string().min(1),
    PORT: z.coerce.number().int().min(1).max(65535),
    JWT_SECRET: fakeDataMode 
      ? z.string().default('fake-dev-secret')
      : z.string().min(1, 'JWT_SECRET is required'),
    BOT_USERNAME: z.string().optional().default(''),
    BOT_TOKEN: z.string().optional().default(''),
    MONGO_URL: z.string().regex(/^mongodb(\+srv)?:\/\//, 'Invalid MongoDB URI format'),
    MONGO_URL_SECONDARY: z.string().regex(/^mongodb(\+srv)?:\/\//, 'Invalid MongoDB URI format'),
    NODE_ENV: z.enum(['development', 'production', 'test']),
    FAKE_DATA_MODE: z.enum(['true', 'false']).optional().default('false'),
    
    // Telegram
    TELEGRAM_BOT_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    OAUTH_TELEGRAM_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    TELEGRAM_API_URL: urlValidator.default('https://api.telegram.org'),
    TELEGRAM_AVATAR_BASE_URL: urlValidator.optional(),
    DICEBEAR_API_URL: urlValidator.optional(),
    
    // OAuth providers - enabled flags
    OAUTH_GOOGLE_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    OAUTH_YANDEX_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    OAUTH_VK_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    OAUTH_APPLE_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    OAUTH_TWITTER_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    OAUTH_INSTAGRAM_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    OAUTH_SBER_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    OAUTH_MAILRU_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    
    // OAuth providers - credentials (optional, but validated if provided)
    OAUTH_GOOGLE_CLIENT_ID: z.string().optional(),
    OAUTH_GOOGLE_CLIENT_SECRET: z.string().optional(),
    OAUTH_GOOGLE_REDIRECT_URI: urlValidator.optional(),
    OAUTH_GOOGLE_CALLBACK_URL: urlValidator.optional(),
    GOOGLE_REDIRECT_URI: urlValidator.optional(),
    
    OAUTH_YANDEX_CLIENT_ID: z.string().optional(),
    OAUTH_YANDEX_CLIENT_SECRET: z.string().optional(),
    OAUTH_YANDEX_REDIRECT_URI: urlValidator.optional(),
    OAUTH_YANDEX_CALLBACK_URL: urlValidator.optional(),
    
    OAUTH_VK_CLIENT_ID: z.string().optional(),
    OAUTH_VK_CLIENT_SECRET: z.string().optional(),
    OAUTH_VK_REDIRECT_URI: urlValidator.optional(),
    
    OAUTH_APPLE_CLIENT_ID: z.string().optional(),
    OAUTH_APPLE_CLIENT_SECRET: z.string().optional(),
    OAUTH_APPLE_REDIRECT_URI: urlValidator.optional(),
    
    OAUTH_TWITTER_CLIENT_ID: z.string().optional(),
    OAUTH_TWITTER_CLIENT_SECRET: z.string().optional(),
    OAUTH_TWITTER_REDIRECT_URI: urlValidator.optional(),
    
    OAUTH_INSTAGRAM_CLIENT_ID: z.string().optional(),
    OAUTH_INSTAGRAM_CLIENT_SECRET: z.string().optional(),
    OAUTH_INSTAGRAM_REDIRECT_URI: urlValidator.optional(),
    
    OAUTH_SBER_CLIENT_ID: z.string().optional(),
    OAUTH_SBER_CLIENT_SECRET: z.string().optional(),
    OAUTH_SBER_REDIRECT_URI: urlValidator.optional(),
    
    OAUTH_MAILRU_CLIENT_ID: z.string().optional(),
    OAUTH_MAILRU_CLIENT_SECRET: z.string().optional(),
    OAUTH_MAILRU_REDIRECT_URI: urlValidator.optional(),
    OAUTH_MAILRU_CALLBACK_URL: urlValidator.optional(),
    
    // WebAuthn
    AUTHN_ENABLED: z.enum(['true', 'false']).optional().default('false'),
    RP_ID: z.string().optional(),
    RP_ORIGIN: urlValidator.optional(),
    RP_NAME: z.string().optional(),
    
    // S3 Storage
    S3_ENDPOINT: urlValidator.optional(),
    S3_BUCKET_NAME: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_REGION: awsRegionValidator,
    
    // Feature flags
    ENABLE_COMMENT_IMAGE_UPLOADS: z.enum(['true', 'false']).optional().default('false'),
    NEXT_PUBLIC_ENABLE_COMMENT_IMAGE_UPLOADS: z.enum(['true', 'false']).optional().default('false'),
    ENABLE_ANALYTICS: z.enum(['true', 'false']).optional().default('false'),
    NEXT_PUBLIC_ENABLE_ANALYTICS: z.enum(['true', 'false']).optional().default('false'),
    ENABLE_DEBUG: z.enum(['true', 'false']).optional().default('false'),
    NEXT_PUBLIC_ENABLE_DEBUG: z.enum(['true', 'false']).optional().default('false'),
    ENABLE_COMMENT_VOTING: z.enum(['true', 'false']).optional().default('false'),
    NEXT_PUBLIC_ENABLE_COMMENT_VOTING: z.enum(['true', 'false']).optional().default('false'),
    ENABLE_LOGIN_INVITE_FORM: z.enum(['true', 'false']).optional().default('false'),
    NEXT_PUBLIC_ENABLE_LOGIN_INVITE_FORM: z.enum(['true', 'false']).optional().default('false'),
    
    // App URL (optional, for backward compatibility)
    APP_URL: urlValidator.optional(),
  });

  // Parse the config and throw if invalid
  const result = envSchema.safeParse(configWithDefaults);
  
  if (!result.success) {
    const errors = result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Configuration validation error: ${errors}`);
  }

  return result.data;
};

export const validationSchema = {
  validate: (config: Record<string, unknown>) => {
    try {
      const value = validateSync(config);
      return { error: null, value };
    } catch (error) {
      return { error, value: undefined };
    }
  },
  validateSync,
};
