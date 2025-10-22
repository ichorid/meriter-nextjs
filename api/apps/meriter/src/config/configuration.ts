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
  telegram: {
    globalFeedChatId: string;
  };
  database: {
    mongoUrl: string;
    mongoUrlSecondary: string;
  };
}

export default (): AppConfig => ({
  app: {
    url: process.env.APP_URL || 'https://meriter.pro',
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
  telegram: {
    globalFeedChatId: process.env.GLOBAL_FEED_TG_CHAT_ID || '-1001243037875',
  },
  database: {
    mongoUrl: process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/meriter',
    mongoUrlSecondary: process.env.MONGO_URL_SECONDARY || 'mongodb://127.0.0.1:27017/meriter_test',
  },
});

