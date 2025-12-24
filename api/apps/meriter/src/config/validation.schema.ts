import { z } from 'zod';

// Custom Joi-style wrapper for NestJS ConfigModule compatibility
// ConfigModule expects a validationSchema with both validate and validateSync methods
const validateSync = (config: Record<string, unknown>) => {
  const nodeEnv = config.NODE_ENV || 'development';
  const fakeDataMode = config.FAKE_DATA_MODE === 'true';
  
  // Validate DOMAIN is set - required for proper cookie domain scoping
  // Derive from APP_URL for backward compatibility if DOMAIN is not explicitly set
  // Exception: In test environment, defaults to localhost for testing
  let domain = config.DOMAIN as string;
  if (!domain) {
    if (config.APP_URL) {
      try {
        domain = new URL(config.APP_URL as string).hostname;
      } catch {
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
    NODE_ENV: (config.NODE_ENV as string) || 'development',
    FAKE_DATA_MODE: config.FAKE_DATA_MODE || 'false',
    TELEGRAM_BOT_ENABLED: (config.TELEGRAM_BOT_ENABLED as string) || 'false',
    OAUTH_TELEGRAM_ENABLED: (config.OAUTH_TELEGRAM_ENABLED as string) || 'false',
  };

  const envSchema = z.object({
    DOMAIN: z.string(),
    PORT: z.number(),
    JWT_SECRET: fakeDataMode 
      ? z.string().default('fake-dev-secret')
      : z.string().min(1, 'JWT_SECRET is required'),
    BOT_USERNAME: z.string().optional().default(''),
    BOT_TOKEN: z.string().optional().default(''),
    MONGO_URL: z.string(),
    MONGO_URL_SECONDARY: z.string(),
    NODE_ENV: z.enum(['development', 'production', 'test']),
    FAKE_DATA_MODE: z.string().optional(),
    TELEGRAM_BOT_ENABLED: z.string().optional().default('false'),
    OAUTH_TELEGRAM_ENABLED: z.string().optional().default('false'),
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
