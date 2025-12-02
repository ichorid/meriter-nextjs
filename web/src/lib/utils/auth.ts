/**
 * Authentication utility functions
 * Centralized location for auth-related utilities
 */

/**
 * Clears all cookies, localStorage, and sessionStorage
 * Used during logout to ensure complete cleanup
 */
/**
 * Clears JWT cookie specifically with proper attributes
 * Exported so it can be called before authentication to ensure clean state
 */
/**
 * Get cookie domain from DOMAIN environment variable
 * Returns undefined for localhost (no domain restriction needed)
 * Falls back to APP_URL extraction for backward compatibility if DOMAIN is not set
 */
function getCookieDomain(): string | undefined {
  // On client-side, use current hostname for runtime detection
  // This allows one build to work across multiple environments (dev, stage, prod)
  // and ensures cookies are scoped to the exact domain where code is running
  if (typeof window !== 'undefined') {
    const hostname = window.location?.hostname;
    
    // Validate hostname is available (should always be present in browser)
    if (!hostname) {
      throw new Error(
        'Failed to detect cookie domain: window.location.hostname is undefined. ' +
        'This should not happen in a browser environment. Check your deployment configuration.'
      );
    }
    
    // For cookie clearing, use the exact hostname (no subdomain sharing)
    // This ensures cookies are scoped to the exact domain (dev.meriter.pro, stage.meriter.pro, etc.)
    // localhost doesn't need domain restriction
    return hostname === 'localhost' ? undefined : hostname;
  }
  
  // Server-side: require env vars (available during SSR)
  // This is critical for proper cookie domain configuration
  const domain = process.env.NEXT_PUBLIC_DOMAIN || process.env.DOMAIN;
  
  if (domain) {
    return domain === 'localhost' ? undefined : domain;
  }
  
  // Backward compatibility: extract domain from APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      const hostname = url.hostname.split(':')[0]; // Remove port if present
      return hostname === 'localhost' ? undefined : hostname;
    } catch (error) {
      throw new Error(
        'Failed to determine cookie domain: APP_URL is not a valid URL. ' +
        'Set DOMAIN environment variable or provide a valid APP_URL.'
      );
    }
  }
  
  // Fail if domain cannot be determined on server-side
  throw new Error(
    'Failed to determine cookie domain: DOMAIN environment variable is required on server-side. ' +
    'Set DOMAIN to your domain (e.g., dev.meriter.pro, stage.meriter.pro, or meriter.pro). ' +
    'This is required for proper cookie domain configuration during SSR.'
  );
}

/**
 * Clears a single cookie with multiple attribute combinations to ensure all variants are removed
 * @param cookieName Name of the cookie to clear
 * @param cookieDomain Optional domain override
 */
function clearCookieVariants(cookieName: string, cookieDomain?: string | undefined): void {
  if (typeof document === 'undefined') return;
  
  const domain = cookieDomain ?? getCookieDomain();
  const isProduction = process.env.NODE_ENV === 'production';
  const expiry = 'Thu, 01 Jan 1970 00:00:00 GMT';
  
  // Generate all domain variants to try
  const domainsToTry: (string | undefined)[] = [undefined]; // Always try no domain
  domainsToTry.push(window.location.hostname); // Current domain
  
  if (domain && domain !== 'localhost' && domain !== window.location.hostname) {
    domainsToTry.push(domain);
    
    // Try variants with/without leading dot
    if (!domain.startsWith('.')) {
      domainsToTry.push(`.${domain}`);
    }
    if (domain.startsWith('.')) {
      domainsToTry.push(domain.substring(1));
    }
  }
  
  // Try parent domain for subdomains
  if (window.location.hostname.includes('.')) {
    const parentDomain = '.' + window.location.hostname.split('.').slice(-2).join('.');
    if (!domainsToTry.includes(parentDomain)) {
      domainsToTry.push(parentDomain);
    }
  }
  
  // Try clearing with all combinations of attributes
  const pathsToTry = ['/', '']; // Root path and no path
  const sameSiteOptions = isProduction 
    ? ['none', 'lax'] as const
    : ['lax', 'none'] as const;
  
  for (const domainVariant of domainsToTry) {
    for (const path of pathsToTry) {
      for (const sameSite of sameSiteOptions) {
        // Try with secure flag
        let cookieStr = `${cookieName}=;expires=${expiry};path=${path}`;
        if (domainVariant) {
          cookieStr += `;domain=${domainVariant}`;
        }
        if (isProduction || sameSite === 'none') {
          cookieStr += `;secure`;
        }
        cookieStr += `;sameSite=${sameSite}`;
        document.cookie = cookieStr;
        
        // Also try without secure flag (for localhost/dev)
        if (isProduction) {
          cookieStr = `${cookieName}=;expires=${expiry};path=${path}`;
          if (domainVariant) {
            cookieStr += `;domain=${domainVariant}`;
          }
          cookieStr += `;sameSite=${sameSite}`;
          document.cookie = cookieStr;
        }
      }
    }
  }
}

/**
 * Clears ALL cookies from the browser
 * Attempts to clear all cookies by reading document.cookie and clearing each one
 * Also ensures JWT cookie variants are cleared
 */
export function clearAllCookies(): void {
  if (typeof document === 'undefined') return;
  
  // Read all cookies from document.cookie
  const cookies = document.cookie.split(';');
  const cookieNames = new Set<string>();
  
  // Extract cookie names (cookies are in format "name=value" or just "name=")
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed) {
      const name = trimmed.split('=')[0].trim();
      if (name) {
        cookieNames.add(name);
      }
    }
  }
  
  // Clear each cookie with multiple attribute combinations
  const cookieDomain = getCookieDomain();
  for (const cookieName of cookieNames) {
    clearCookieVariants(cookieName, cookieDomain);
  }
  
  // Also explicitly clear JWT cookie variants (in case it's HttpOnly and not in document.cookie)
  clearCookieVariants('jwt', cookieDomain);
  
  // Clear known cookies that might be HttpOnly (they won't appear in document.cookie)
  const knownCookies = ['jwt', 'fake_user_id', 'NEXT_LOCALE'];
  for (const cookieName of knownCookies) {
    clearCookieVariants(cookieName, cookieDomain);
  }
}

export function clearJwtCookie(): void {
  if (typeof document === 'undefined') return;
  
  const cookieDomain = getCookieDomain();
  clearCookieVariants('jwt', cookieDomain);
}

/**
 * Check if JWT cookie exists in browser
 * @returns true if JWT cookie exists, false otherwise
 */
export function hasJwtCookie(): boolean {
  if (typeof document === 'undefined') return false;
  
  // Check if jwt cookie exists
  const cookies = document.cookie.split(';');
  return cookies.some(cookie => cookie.trim().startsWith('jwt='));
}

export function clearAuthStorage(): void {
  // Clear ALL cookies (not just JWT) to prevent login loops with stale cookies
  clearAllCookies();

  // Clear localStorage and sessionStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
}

/**
 * Redirects to login page with optional return URL
 */
export function redirectToLogin(returnTo?: string): void {
  if (typeof window === 'undefined') return;
  
  const returnParam = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  window.location.href = `/meriter/login${returnParam}`;
}

/**
 * Handles authentication redirect after successful login
 * Uses hard redirect to ensure cookies are properly set before next requests
 * Always redirects to /meriter/home if no returnTo is specified
 */
export function handleAuthRedirect(returnTo?: string | null, fallbackUrl: string = '/meriter/home'): void {
  if (typeof window === 'undefined') return;
  
  // Always use fallbackUrl (/meriter/home) if returnTo is not specified or is login page
  const redirectUrl = returnTo && returnTo !== '/meriter/login' ? returnTo : fallbackUrl;
  window.location.href = redirectUrl;
}


