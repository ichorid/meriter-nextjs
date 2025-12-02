export interface AppConfig {
  app: {
    url: string;
    port: number;
    env: string;
  };
  jwt: {
    secret: string;
  };
  bot: {
    username: string;
    token: string;
  };
  database: {
    mongoUrl: string;
    mongoUrlSecondary: string;
  };
}

/**
 * Derive application URL from DOMAIN
 * Protocol: http:// for localhost, https:// for production
 * Falls back to APP_URL for backward compatibility if DOMAIN is not set
 * REQUIRES: DOMAIN environment variable must be set (validated by validation schema)
 */
function deriveAppUrl(): string {
  const domain = process.env.DOMAIN;
  
  if (!domain) {
    // Backward compatibility: if APP_URL exists but DOMAIN doesn't, use APP_URL
    // However, this should not happen as validation schema requires DOMAIN
    if (process.env.APP_URL) {
      return process.env.APP_URL;
    }
    throw new Error('DOMAIN environment variable is required. Set DOMAIN to your domain (e.g., dev.meriter.pro, stage.meriter.pro, or meriter.pro).');
  }
  
  // Use http:// for localhost, https:// for production
  const protocol = domain === 'localhost' ? 'http://' : 'https://';
  return `${protocol}${domain}`;
}

export default (): AppConfig => ({
  app: {
    url: deriveAppUrl(),
    port: parseInt(process.env.PORT, 10) || 8002,
    env: process.env.NODE_ENV || 'development',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
  },
  bot: {
    username: process.env.BOT_USERNAME || 'meriterbot',
    token: process.env.BOT_TOKEN || '',
  },
  database: {
    mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/meriter',
    mongoUrlSecondary: process.env.MONGO_URL_SECONDARY || 'mongodb://127.0.0.1:27017/meriter_test',
  },
});

