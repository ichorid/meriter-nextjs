import { z } from 'zod';

// Custom Joi-style wrapper for NestJS ConfigModule compatibility
// ConfigModule expects a validationSchema with both validate and validateSync methods
const validateSync = (config: Record<string, unknown>) => {
  const nodeEnv = config.NODE_ENV || 'development';
  
  // Apply defaults manually before validation
  const configWithDefaults = {
    // DOMAIN is optional, defaults to meriter.pro
    // For backward compatibility, derive from APP_URL if DOMAIN is not set
    DOMAIN: (config.DOMAIN as string) || (config.APP_URL ? new URL(config.APP_URL as string).hostname : 'meriter.pro'),
    PORT: config.PORT ? Number(config.PORT) : 8002,
    JWT_SECRET: (config.JWT_SECRET as string) || '',
    BOT_USERNAME: (config.BOT_USERNAME as string) || '',
    BOT_TOKEN: (config.BOT_TOKEN as string) || '',
    MONGO_URL: (config.MONGO_URL as string) || 'mongodb://127.0.0.1:27017/meriter',
    MONGO_URL_SECONDARY: (config.MONGO_URL_SECONDARY as string) || 'mongodb://127.0.0.1:27017/meriter_test',
    NODE_ENV: (config.NODE_ENV as string) || 'development',
  };

  // Conditional validation: BOT_USERNAME required in production
  if (nodeEnv === 'production' && (!configWithDefaults.BOT_USERNAME || configWithDefaults.BOT_USERNAME.trim() === '')) {
    throw new Error('BOT_USERNAME is required in production');
  }

  const envSchema = z.object({
    DOMAIN: z.string(),
    PORT: z.number(),
    JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
    BOT_USERNAME: z.string(),
    BOT_TOKEN: z.string(),
    MONGO_URL: z.string(),
    MONGO_URL_SECONDARY: z.string(),
    NODE_ENV: z.enum(['development', 'production', 'test']),
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

