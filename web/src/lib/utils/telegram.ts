/**
 * Telegram utility functions
 * Centralized location for all Telegram-related utilities
 */

import { config } from '@/config';

// Deep link utilities
/**
 * Creates a Telegram deep link URL
 * @param botUsername - Bot username (required, no fallback)
 * @param path - Deep link path
 * @param params - Optional query parameters
 * @returns Telegram deep link URL
 */
export function createTelegramDeepLink(botUsername: string, path: string, params: Record<string, string> = {}): string {
  // Fail fast - no fallbacks
  if (!botUsername || botUsername.trim() === '') {
    throw new Error('botUsername is required for createTelegramDeepLink');
  }

  const queryString = new URLSearchParams(params).toString();
  const fullPath = queryString ? `${path}?${queryString}` : path;
  
  return `https://t.me/${botUsername}?startapp=${encodeURIComponent(fullPath)}`;
}

/**
 * Creates a Telegram deep link for a publication
 * @param botUsername - Bot username (required, no fallback)
 * @param publicationId - Publication ID
 * @returns Telegram deep link URL
 */
export function createPublicationDeepLink(botUsername: string, publicationId: string): string {
  return createTelegramDeepLink(botUsername, `publication&id=${publicationId}`);
}

/**
 * Creates a Telegram deep link for a community
 * @param botUsername - Bot username (required, no fallback)
 * @param communityId - Community ID
 * @returns Telegram deep link URL
 */
export function createCommunityDeepLink(botUsername: string, communityId: string): string {
  return createTelegramDeepLink(botUsername, `community&id=${communityId}`);
}

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown).Telegram?.WebApp;
}

// Avatar utilities
export function telegramGetAvatarLink(chat_id: string | number) {
  if (!chat_id || chat_id === 'undefined' || !config.s3.enabled) return '';

  const telegramCdnUrl = config.telegram.avatarBaseUrl;

  if (!telegramCdnUrl) {
    return '';
  }

  return `${telegramCdnUrl}/telegram_small_avatars/${chat_id}.jpg`;
}
