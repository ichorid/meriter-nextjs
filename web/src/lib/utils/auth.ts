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
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
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

