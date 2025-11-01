/**
 * Authentication utility functions
 * Centralized location for auth-related utilities
 */

/**
 * Clears all cookies, localStorage, and sessionStorage
 * Used during logout to ensure complete cleanup
 */
export function clearAuthStorage(): void {
  // Clear all cookies
  if (typeof document !== 'undefined') {
    const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || window.location.hostname;
    
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      
      // Clear cookie with multiple domain/path combinations to ensure it's removed
      const expiry = 'Thu, 01 Jan 1970 00:00:00 GMT';
      
      // Clear with root path
      document.cookie = `${name}=;expires=${expiry};path=/`;
      
      // Clear with current domain
      document.cookie = `${name}=;expires=${expiry};path=/;domain=${window.location.hostname}`;
      
      // Clear with cookie domain if set
      if (cookieDomain && cookieDomain !== window.location.hostname) {
        document.cookie = `${name}=;expires=${expiry};path=/;domain=${cookieDomain}`;
      }
      
      // Clear with domain starting with dot (for subdomains)
      if (window.location.hostname.includes('.')) {
        const parentDomain = '.' + window.location.hostname.split('.').slice(-2).join('.');
        document.cookie = `${name}=;expires=${expiry};path=/;domain=${parentDomain}`;
      }
    });
  }

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

