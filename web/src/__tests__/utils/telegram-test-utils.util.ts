/**
 * Telegram-specific Test Utilities
 * 
 * Provides helpers for testing Telegram Web App authentication
 */

import crypto from 'crypto';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  is_bot?: boolean;
}

/**
 * Generate valid Telegram Web App initData string
 * Follows the same validation logic as the backend
 */
export function generateValidInitData(
  userData: TelegramUser,
  botToken: string,
  options: {
    authDate?: number;
    queryId?: string;
    chatInstance?: string;
  } = {}
): string {
  const authDate = options.authDate || Math.floor(Date.now() / 1000);
  const user = JSON.stringify(userData);
  
  const params: Record<string, string> = {
    auth_date: authDate.toString(),
    user,
  };
  
  if (options.queryId) {
    params.query_id = options.queryId;
  }
  
  if (options.chatInstance) {
    params.chat_instance = options.chatInstance;
  }
  
  // Create data check string (sorted alphabetically)
  const dataCheckString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('\n');
  
  // Create secret key using WebAppData constant
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  
  // Calculate hash
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // Build query string
  const queryParams = new URLSearchParams(params);
  queryParams.set('hash', hash);
  
  return queryParams.toString();
}

/**
 * Generate expired initData for testing expired auth scenarios
 */
export function generateExpiredInitData(
  userData: TelegramUser,
  botToken: string,
  hoursAgo: number = 25
): string {
  const expiredAuthDate = Math.floor(Date.now() / 1000) - (hoursAgo * 60 * 60);
  return generateValidInitData(userData, botToken, { authDate: expiredAuthDate });
}

/**
 * Generate invalid initData with wrong hash
 */
export function generateInvalidInitData(userData: TelegramUser): string {
  const authDate = Math.floor(Date.now() / 1000);
  const user = JSON.stringify(userData);
  const invalidHash = 'invalid_hash_value_1234567890';
  
  return `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=${invalidHash}`;
}

/**
 * Mock Telegram SDK environment
 */
export function mockTelegramEnvironment(
  options: {
    platform?: 'ios' | 'android' | 'web' | 'macos';
    startParam?: string | null;
    initData?: string;
    isDark?: boolean;
  } = {}
) {
  const {
    platform = 'ios',
    startParam = null,
    initData = null,
    isDark = false,
  } = options;
  
  return {
    launchParams: {
      tgWebAppPlatform: platform,
      tgWebAppStartParam: startParam,
    },
    initData: {
      value: initData,
    },
    miniApp: {
      isDark: {
        value: isDark,
      },
    },
  };
}

/**
 * Mock Telegram widget callback
 */
export function mockTelegramWidgetAuth(userData: TelegramUser) {
  const authData = {
    id: userData.id,
    first_name: userData.first_name,
    last_name: userData.last_name,
    username: userData.username,
    photo_url: undefined,
    auth_date: Math.floor(Date.now() / 1000),
    hash: 'mock_widget_hash',
  };
  
  // Simulate widget callback
  if (typeof window !== 'undefined' && (window as any).onTelegramAuth) {
    (window as any).onTelegramAuth(authData);
  }
  
  return authData;
}
