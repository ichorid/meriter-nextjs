/**
 * Avatar Utilities
 * 
 * Generates avatar URLs for users. Uses Meriter's avatar system.
 */

/**
 * Get avatar URL from comment author meta or fallback to generated avatar
 */
export function getAvatarUrl(authorName: string, photoUrl?: string): string {
  if (photoUrl) {
    return photoUrl;
  }
  // Fallback: could use a default avatar or generate one
  // For now, return empty string and let the component handle it
  return '';
}

