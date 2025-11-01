/**
 * Centralized Configuration System
 * 
 * This module provides type-safe access to all configuration values
 * used throughout the application. It validates environment variables
 * and provides sensible defaults for development.
 */

import { z } from 'zod';

// Environment variable validation schema
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().default('https://meriter.pro'),
  
  // API Configuration - optional, defaults to relative URLs in production
  NEXT_PUBLIC_API_URL: z.string().optional(),
  
  // Telegram Configuration
  BOT_TOKEN: z.string().optional(),
  NEXT_PUBLIC_TELEGRAM_API_URL: z.string().default('https://api.telegram.org'),
  
  // S3 Configuration
  NEXT_PUBLIC_S3_ENABLED: z.string().optional(),
  NEXT_PUBLIC_TELEGRAM_AVATAR_BASE_URL: z.string().default('https://telegram.hb.bizmrg.com'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().default('https://hb.bizmrg.com'),
  S3_REGION: z.string().default('ru-msk'),
  
  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().optional(),
  NEXT_PUBLIC_ENABLE_DEBUG: z.string().optional(),
});

// Validate and parse environment variables
const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  APP_URL: process.env.APP_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  BOT_TOKEN: process.env.BOT_TOKEN,
  NEXT_PUBLIC_TELEGRAM_API_URL: process.env.NEXT_PUBLIC_TELEGRAM_API_URL,
  NEXT_PUBLIC_S3_ENABLED: process.env.NEXT_PUBLIC_S3_ENABLED,
  NEXT_PUBLIC_TELEGRAM_AVATAR_BASE_URL: process.env.NEXT_PUBLIC_TELEGRAM_AVATAR_BASE_URL,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
  NEXT_PUBLIC_ENABLE_DEBUG: process.env.NEXT_PUBLIC_ENABLE_DEBUG,
});

// Debug logging for environment variables
console.log('🔧 Environment Variables Debug:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  NEXT_PUBLIC_API_URL (raw):', process.env.NEXT_PUBLIC_API_URL);
console.log('  NEXT_PUBLIC_API_URL (parsed):', env.NEXT_PUBLIC_API_URL);
console.log('  APP_URL:', env.APP_URL);
console.log('  BOT_TOKEN:', env.BOT_TOKEN ? '[SET]' : '[NOT SET]');
console.log('  S3_ACCESS_KEY_ID:', env.S3_ACCESS_KEY_ID ? '[SET]' : '[NOT SET]');
console.log('  S3_SECRET_ACCESS_KEY:', env.S3_SECRET_ACCESS_KEY ? '[SET]' : '[NOT SET]');

// Configuration object with computed values
export const config = {
  // Application
  app: {
    env: env.NODE_ENV,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    url: env.APP_URL,
  },
  
  // API
  api: {
    // In production with Caddy, use relative URLs (empty string) when not explicitly set
    // In development, default to localhost
    // When explicitly set, always use the provided value
    baseUrl: env.NEXT_PUBLIC_API_URL ?? (env.NODE_ENV === 'production' ? '' : 'http://localhost:8002'),
    endpoints: {
      auth: '/api/v1/auth',
      publications: '/api/v1/publications',
      comments: '/api/v1/comments',
      communities: '/api/v1/communities',
      polls: '/api/v1/polls',
      wallet: '/api/v1/users/me/wallets',
      transactions: '/api/v1/users/me/transactions',
      votes: '/api/v1/votes',
      users: '/api/v1/users',
    },
  },
  
  // Telegram
  telegram: {
    botToken: env.BOT_TOKEN,
    apiUrl: env.NEXT_PUBLIC_TELEGRAM_API_URL,
    botUrl: env.BOT_TOKEN ? `${env.NEXT_PUBLIC_TELEGRAM_API_URL}/bot${env.BOT_TOKEN}` : '',
    avatarBaseUrl: env.NEXT_PUBLIC_TELEGRAM_AVATAR_BASE_URL,
  },
  
  // S3 Storage
  s3: {
    enabled: env.NEXT_PUBLIC_S3_ENABLED !== 'false' && !!env.S3_ACCESS_KEY_ID && !!env.S3_SECRET_ACCESS_KEY,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
  },
  
  // Feature Flags
  features: {
    analytics: env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
    debug: env.NEXT_PUBLIC_ENABLE_DEBUG === 'true' || env.NODE_ENV === 'development',
  },
  
  // Messages and Templates
  // Note: These templates use BOT_USERNAME from process.env directly (server-side only)
  // They will throw error if BOT_USERNAME is missing
  messages: (() => {
    const botUsername = process.env.BOT_USERNAME;
    if (!botUsername || botUsername.trim() === '') {
      throw new Error('BOT_USERNAME environment variable is required for message templates');
    }
    
    return {
      welcomeLeader: `Добро пожаловать в Меритер!

Добавьте этого бота (@${botUsername}) в один из чатов, в котором являетесь администратором. Для этого кликните на заголовок <b>этого</b> чата, далее на кнопку "еще"/"more", а затем на "добавить в группу"/"add to group" и выберите сообщество, в которое будет добавлен бот.`,
      
      welcomeUser: `Добро пожаловать в Меритер! Войдите через приложение: https://t.me/${botUsername}?startapp=login`,
      
      authUser: `Войдите через приложение: https://t.me/${botUsername}?startapp=login`,
      
      addedPublicationReply: `Сообщение добавлено в приложение https://t.me/${botUsername}?startapp=publication&id={link}. Перейдите, чтобы оставить своё мнение и узнать, что думают другие`,
      
      approvedPendingWords: ['одобрить'],
    };
  })(),
} as const;

// Type exports for better TypeScript support
export type Config = typeof config;
export type AppConfig = typeof config.app;
export type ApiConfig = typeof config.api;
export type TelegramConfig = typeof config.telegram;
export type S3Config = typeof config.s3;
export type FeaturesConfig = typeof config.features;
export type MessagesConfig = typeof config.messages;

// Utility functions
export const isDevelopment = () => config.app.isDevelopment;
export const isProduction = () => config.app.isProduction;
export const isTest = () => config.app.isTest;

// Legacy exports for backward compatibility
// Note: BOT_USERNAME is no longer available from config - use BotConfigContext instead
export const BOT_TOKEN = config.telegram.botToken;
export const BOT_URL = config.telegram.botUrl;
export const URL = config.app.url;

export default config;
