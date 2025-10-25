/**
 * Avatar URL generation utilities
 */

export function getAvatarUrl(userId: string, type: 'user' | 'community' = 'user'): string {
  const baseUrl = process.env.NEXT_PUBLIC_TELEGRAM_AVATAR_BASE_URL || 'https://telegram.hb.bizmrg.com';
  return `${baseUrl}/${type === 'user' ? 'users' : 'communities'}/${userId}`;
}

export function getCommunityAvatarUrl(communityId: string): string {
  return getAvatarUrl(communityId, 'community');
}

export function getUserAvatarUrl(userId: string): string {
  return getAvatarUrl(userId, 'user');
}
