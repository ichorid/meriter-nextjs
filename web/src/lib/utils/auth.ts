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
  // Try NEXT_PUBLIC_DOMAIN first (set from root DOMAIN env var)
  const domain = process.env.NEXT_PUBLIC_DOMAIN || process.env.DOMAIN;
  
  if (domain) {
    // localhost doesn't need domain restriction
    return domain === 'localhost' ? undefined : domain;
  }
  
  // Backward compatibility: if APP_URL exists but DOMAIN doesn't, extract domain from APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      const hostname = url.hostname.split(':')[0]; // Remove port if present
      return hostname === 'localhost' ? undefined : hostname;
    } catch (error) {
      // If APP_URL is not a valid URL, return undefined
      return undefined;
    }
  }
  
  return undefined;
}

export function clearJwtCookie(): void {
  if (typeof document === 'undefined') return;
  
  const cookieDomain = getCookieDomain();
  const isProduction = process.env.NODE_ENV === 'production';
  const expiry = 'Thu, 01 Jan 1970 00:00:00 GMT';
  
  // Clear JWT cookie with same attributes used when setting it
  const clearCookie = (domain?: string) => {
    let cookieStr = `jwt=;expires=${expiry};path=/`;
    if (domain) {
      cookieStr += `;domain=${domain}`;
    }
    if (isProduction) {
      cookieStr += `;secure;sameSite=none`;
    } else {
      cookieStr += `;sameSite=lax`;
    }
    document.cookie = cookieStr;
  };
  
  // Try clearing with different domain combinations
  clearCookie(); // No domain
  clearCookie(window.location.hostname); // Current domain
  
  if (cookieDomain && cookieDomain !== window.location.hostname) {
    clearCookie(cookieDomain); // Cookie domain if set
    
    // Try variants with/without leading dot
    if (!cookieDomain.startsWith('.')) {
      clearCookie(`.${cookieDomain}`);
    }
    if (cookieDomain.startsWith('.')) {
      clearCookie(cookieDomain.substring(1));
    }
  }
  
  // Try parent domain for subdomains
  if (window.location.hostname.includes('.')) {
    const parentDomain = '.' + window.location.hostname.split('.').slice(-2).join('.');
    clearCookie(parentDomain);
  }
}

export function clearAuthStorage(): void {
  // Clear JWT cookie specifically
  clearJwtCookie();

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

