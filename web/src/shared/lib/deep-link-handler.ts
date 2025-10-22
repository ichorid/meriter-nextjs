import { useRouter, useSearchParams } from 'next/navigation';
import { decodeTelegramDeepLink } from './base64url';

export interface DeepLinkParams {
  startapp?: string | null;
  id?: string | null;
  returnTo?: string | null;
}

export interface DeepLinkHandler {
  handleDeepLink: (hasPendingCommunities?: boolean) => void;
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
  const handleDeepLink = (hasPendingCommunities?: boolean) => {
    let startapp = searchParams.get('startapp');
    let id = searchParams.get('id');
    const returnTo = searchParams.get('returnTo');
    
    // Parse Telegram start_param (base64url encoded)
    if (telegramStartParam) {
      console.log('🔗 Parsing Telegram start_param (base64url):', telegramStartParam);
      
      try {
        const decoded = decodeTelegramDeepLink(telegramStartParam);
        startapp = decoded.action;
        id = decoded.id;
        console.log('🔗 Decoded startapp:', startapp, 'id:', id);
      } catch (error) {
        console.error('🔗 Failed to decode Telegram start_param:', error);
        // Fallback to treating as simple action
        startapp = telegramStartParam;
      }
    }
    
    let redirectPath = '/meriter/home'; // default
    
    // Handle deep link navigation based on startapp parameter
    if (startapp === 'publication' && id) {
      console.log('🔗 Deep link: Redirecting to publication:', id);
      
      // Check if id contains a path like "communities/chatId/posts/slug"
      if (id.includes('communities/') && id.includes('/posts/')) {
        const pathParts = id.split('/');
        if (pathParts.length >= 4) {
          const chatId = pathParts[1];
          const slug = pathParts[3];
          console.log('🔗 Deep link: Parsed community publication path:', { chatId, slug });
          // Redirect to dedicated post page instead of community page with highlighting
          redirectPath = `/meriter/communities/${chatId}/posts/${slug}`;
        } else {
          console.log('🔗 Deep link: Invalid publication path format, using default');
          redirectPath = `/meriter/publications/${id}`;
        }
      } else {
        // Simple publication ID
        redirectPath = `/meriter/publications/${id}`;
      }
    } else if (startapp === 'community' && id) {
      console.log('🔗 Deep link: Redirecting to community:', id);
      redirectPath = `/meriter/communities/${id}`;
    } else if (startapp === 'global-feed') {
      console.log('🔗 Deep link: Redirecting to global feed');
      redirectPath = '/meriter/merit';
    } else if (startapp === 'setup') {
      console.log('🔗 Deep link: Redirecting to community setup');
      redirectPath = '/meriter/setup-community';
    } else if (startapp === 'poll' && id) {
      console.log('🔗 Deep link: Redirecting to poll:', id);
      redirectPath = `/meriter/polls/${id}`;
    } else if (startapp === 'updates') {
      console.log('🔗 Deep link: Redirecting to updates');
      redirectPath = '/meriter/home?updates=true';
    } else if (hasPendingCommunities) {
      console.log('🔗 Deep link: User has pending communities, redirecting to manage');
      redirectPath = '/meriter/manage';
    } else if (returnTo) {
      console.log('🔗 Deep link: Using returnTo parameter:', returnTo);
      redirectPath = returnTo;
    }
    
    console.log('🔗 Deep link: Final redirect path:', redirectPath);
    router.push(redirectPath);
  };

  return { handleDeepLink };
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
