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
 */
function clearJwtCookie(): void {
  if (typeof document === 'undefined') return;
  
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
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

