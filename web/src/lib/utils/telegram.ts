/**
 * Telegram utility functions
 * Centralized location for all Telegram-related utilities
 */

import { config } from '@/config';

// Deep link utilities
export function createTelegramDeepLink(path: string, params: Record<string, string> = {}): string {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'meriterbot';
  const queryString = new URLSearchParams(params).toString();
  const fullPath = queryString ? `${path}?${queryString}` : path;
  
  return `https://t.me/${botUsername}?startapp=${encodeURIComponent(fullPath)}`;
}

export function createPublicationDeepLink(publicationId: string): string {
  return createTelegramDeepLink(`publication&id=${publicationId}`);
}

export function createCommunityDeepLink(communityId: string): string {
  return createTelegramDeepLink(`community&id=${communityId}`);
}

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Telegram?.WebApp;
}

// Avatar utilities
const isS3Enabled = () => {
  return config.s3.enabled;
};

const telegramCdnUrl = config.telegram.avatarBaseUrl;

export function telegramGetAvatarLink(chat_id: string | number) {
  if (!chat_id || chat_id == "undefined" || !isS3Enabled()) return "";
  return `${telegramCdnUrl}/telegram_small_avatars/${chat_id}.jpg`;
}
