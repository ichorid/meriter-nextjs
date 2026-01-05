import { useCallback, useMemo } from 'react';
import { decodeTelegramDeepLink, looksLikeBase64url } from './base64url';

export interface DeepLinkParams {
  startapp?: string | null;
  id?: string | null;
  returnTo?: string | null;
}

export interface DeepLinkHandler {
  handleDeepLink: () => void;
}

/**
 * Hook to handle Telegram Web App deep link navigation
 * @param router - Next.js router instance
 * @param searchParams - URL search parameters
 * @returns Deep link handler functions
 */
export function useDeepLinkHandler(
  router: any, 
  searchParams: any,
  telegramStartParam?: string
): DeepLinkHandler {
  // Memoize handleDeepLink to ensure stable reference
  const handleDeepLink = useCallback(() => {
    let startapp = searchParams?.get?.('startapp');
    let id = searchParams?.get?.('id');
    const returnTo = searchParams?.get?.('returnTo');
    
    // Parse Telegram start_param (could be base64url encoded or plain string)
    if (telegramStartParam) {
      // Check if it looks like base64url encoded data
      if (looksLikeBase64url(telegramStartParam)) {
        try {
          const decoded = decodeTelegramDeepLink(telegramStartParam);
          startapp = decoded.action;
          id = decoded.id;
        } catch (error) {
          console.error('🔗 Failed to decode Telegram start_param:', error);
          console.error('🔗 Start param value:', telegramStartParam);
          // Fallback to treating as simple action
          startapp = telegramStartParam;
        }
      } else {
        startapp = telegramStartParam;
      }
    }
    
    let redirectPath = '/meriter/profile'; // default
    
    // Handle deep link navigation based on startapp parameter
    if (startapp === 'publication' && id) {
      // Check if id contains a path like "communities/chatId/posts/slug"
      if (id.includes('communities/') && id.includes('/posts/')) {
        const pathParts = id.split('/');
        if (pathParts.length >= 4) {
          const chatId = pathParts[1];
          const slug = pathParts[3];
          // Redirect to dedicated post page instead of community page with highlighting
          redirectPath = `/meriter/communities/${chatId}/posts/${slug}`;
        } else {
          redirectPath = `/meriter/publications/${id}`;
        }
      } else {
        // Simple publication ID
        redirectPath = `/meriter/publications/${id}`;
      }
    } else if (startapp === 'community' && id) {
      redirectPath = `/meriter/communities/${id}`;
    } else if (startapp === 'poll' && id) {
      // For polls, we need to fetch the poll data to get the community ID
      // This will be handled by a special poll redirect page
      redirectPath = `/meriter/polls/${id}`;
    } else if (startapp === 'updates') {
      redirectPath = '/meriter/profile?updates=true';
    } else if (returnTo) {
      redirectPath = returnTo;
    }
    
    router?.push?.(redirectPath);
  }, [router, searchParams, telegramStartParam]);

  // Memoize return value to ensure stable reference
  return useMemo(() => ({ handleDeepLink }), [handleDeepLink]);
}

/**
 * Utility function to generate Telegram Web App URLs
 * @param botUsername - Bot username without @
 * @param action - Action parameter (startapp value)
 * @param params - Additional parameters
 * @returns Telegram Web App URL
 */
export function generateTelegramWebAppUrl(
  botUsername: string,
  action?: string,
  params?: Record<string, string>
): string {
  let url = `https://t.me/${botUsername}`;
  
  if (action) {
    url += `?startapp=${action}`;
    
    if (params) {
      const paramString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      url += `&${paramString}`;
    }
  }
  
  return url;
}
