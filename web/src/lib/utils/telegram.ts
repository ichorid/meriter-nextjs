/**
 * Telegram deep link utilities
 */

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
