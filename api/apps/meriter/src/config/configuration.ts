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
 */
function deriveAppUrl(): string {
  const domain = process.env.DOMAIN;
  
  if (domain) {
    // Use http:// for localhost, https:// for production
    const protocol = domain === 'localhost' ? 'http://' : 'https://';
    return `${protocol}${domain}`;
  }
  
  // Backward compatibility: if APP_URL exists but DOMAIN doesn't, use APP_URL
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }
  
  // Default fallback
  return 'https://meriter.pro';
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

