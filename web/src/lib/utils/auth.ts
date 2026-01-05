/**
 * Authentication Utilities
 * 
 * Provides helper functions for authentication, cookie management, and session tracking.
 */

import { AUTH, STORAGE_KEYS } from '@/lib/constants';
import config from '@/config';

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
export function getCookieDomain(): string {
  // Use config.app.domain for cookie domain
  const domain = config.app.domain;

  // For localhost, don't set domain (browser will use current host)
  if (!domain || domain === 'localhost') {
    return '';
  }
  const appUrl = config.app.url;
  if (appUrl?.includes('localhost')) {
    return '';
  }
  return domain;
}

/**
 * Clears a single cookie with multiple attribute combinations to ensure all variants are removed
 * @param cookieName Name of the cookie to clear
 * @param cookieDomain Optional domain override
 */
function clearCookieVariants(cookieName: string, cookieDomain?: string | undefined): void {
  if (typeof document === 'undefined') return;

  const domain = cookieDomain ?? getCookieDomain();
  const isProduction = config.app.isProduction;
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

  // Try clearing with all VALID combinations of attributes
  // Only try valid combinations (no SameSite=None + Secure=false)
  const pathsToTry = ['/', '']; // Root path and no path

  for (const domainVariant of domainsToTry) {
    for (const path of pathsToTry) {
      // Try SameSite=Lax with Secure (works in all environments)
      let cookieStr = `${cookieName}=;expires=${expiry};path=${path}`;
      if (domainVariant) {
        cookieStr += `;domain=${domainVariant}`;
      }
      cookieStr += `;secure;sameSite=lax`;
      document.cookie = cookieStr;

      // Try SameSite=Lax without Secure (for localhost/dev)
      if (!isProduction) {
        cookieStr = `${cookieName}=;expires=${expiry};path=${path}`;
        if (domainVariant) {
          cookieStr += `;domain=${domainVariant}`;
        }
        cookieStr += `;sameSite=lax`;
        document.cookie = cookieStr;
      }

      // Try SameSite=Strict with Secure
      cookieStr = `${cookieName}=;expires=${expiry};path=${path}`;
      if (domainVariant) {
        cookieStr += `;domain=${domainVariant}`;
      }
      cookieStr += `;secure;sameSite=strict`;
      document.cookie = cookieStr;

      // Try SameSite=Strict without Secure (for localhost/dev)
      if (!isProduction) {
        cookieStr = `${cookieName}=;expires=${expiry};path=${path}`;
        if (domainVariant) {
          cookieStr += `;domain=${domainVariant}`;
        }
        cookieStr += `;sameSite=strict`;
        document.cookie = cookieStr;
      }

      // Try SameSite=None + Secure=true (only valid combination for SameSite=None, typically production)
      if (isProduction) {
        cookieStr = `${cookieName}=;expires=${expiry};path=${path}`;
        if (domainVariant) {
          cookieStr += `;domain=${domainVariant}`;
        }
        cookieStr += `;secure;sameSite=none`;
        document.cookie = cookieStr;
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
      const [namePart] = trimmed.split('=');
      const name = (namePart ?? '').trim();
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
 * Always redirects to /meriter/profile if no returnTo is specified
 */
export function handleAuthRedirect(returnTo?: string | null, fallbackUrl: string = '/meriter/profile'): void {
  if (typeof window === 'undefined') return;

  // Always use fallbackUrl (/meriter/profile) if returnTo is not specified or is login page
  const redirectUrl = returnTo && returnTo !== '/meriter/login' ? returnTo : fallbackUrl;
  window.location.href = redirectUrl;
}

/**
 * Path-aware cookie clearing utilities
 * Detects if we're on pages where 401 errors are expected (login, auth pages)
 */

/**
 * Check if current path is a login or auth-related page where 401 errors are expected
 * @returns true if on login/auth page, false otherwise
 */
export function isOnAuthPage(): boolean {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname;
  return (
    pathname === '/meriter/login' ||
    pathname.startsWith('/meriter/login/') ||
    pathname.startsWith('/api/v1/auth/') ||
    pathname.startsWith('/trpc/auth.')
  );
}

/**
 * Check if current path is a public page where authentication is not required
 * @returns true if on public page, false otherwise
 */
export function isOnPublicPage(): boolean {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname;
  return (
    isOnAuthPage() ||
    pathname === '/' ||
    pathname.startsWith('/meriter/about') ||
    pathname.startsWith('/meriter/help')
  );
}

/**
 * Cookie clearing debounce mechanism to prevent race conditions
 */
let cookieClearingInProgress = false;
let cookieClearingTimeout: NodeJS.Timeout | null = null;
let lastCookieClearTime = 0;
const COOKIE_CLEARING_DEBOUNCE_DELAY = 100; // milliseconds
const MIN_TIME_BETWEEN_CLEARS = 1000; // milliseconds - prevent clearing too frequently

/**
 * Check if we just came from an OAuth redirect
 * OAuth redirects typically happen within the last few seconds
 * This helps prevent clearing cookies that were just set by OAuth callback
 */
function isRecentOAuthRedirect(): boolean {
  if (typeof window === 'undefined') return false;

  // Check if we're on profile page (common OAuth redirect target)
  const pathname = window.location.pathname;
  const isProfilePage = pathname === '/meriter/profile' || pathname.startsWith('/meriter/profile') ||
    pathname === '/meriter/welcome' || pathname.startsWith('/meriter/welcome');

  // Check if page was just loaded (navigation timing)
  // OAuth redirects are full page navigations, so we can detect them via navigation timing
  try {
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationTiming) {
      // Calculate time since navigation started
      const now = Date.now();
      const navigationStart = navigationTiming.fetchStart;
      const timeSinceNavigation = now - navigationStart;

      // If page loaded less than 2 seconds ago, might be from OAuth redirect
      // OAuth redirects are typically very fast (< 1 second)
      const isRecentLoad = timeSinceNavigation < 2000;
      return isProfilePage && isRecentLoad;
    }
  } catch (e) {
    // If performance API is not available, fall back to checking if we're on profile page
    // and assume it might be from OAuth if we're on profile page
    return isProfilePage;
  }

  return false;
}

/**
 * Debounced cookie clearing to prevent multiple simultaneous operations
 * @param clearFn Function to execute for clearing cookies
 */
function debounceCookieClearing(clearFn: () => void): void {
  // If already in progress, skip this call (debounce)
  if (cookieClearingInProgress) {
    return;
  }

  // Prevent clearing too frequently (rate limiting)
  const now = Date.now();
  if (now - lastCookieClearTime < MIN_TIME_BETWEEN_CLEARS) {
    return;
  }

  // Clear any pending timeout
  if (cookieClearingTimeout) {
    clearTimeout(cookieClearingTimeout);
    cookieClearingTimeout = null;
  }

  cookieClearingInProgress = true;
  lastCookieClearTime = now;

  try {
    clearFn();
  } finally {
    // Reset after a short delay to allow cookie operations to complete
    cookieClearingTimeout = setTimeout(() => {
      cookieClearingInProgress = false;
      cookieClearingTimeout = null;
    }, COOKIE_CLEARING_DEBOUNCE_DELAY);
  }
}

/**
 * Clears cookies with debouncing and path awareness
 * Skips clearing on auth pages where 401 errors are expected
 * Also skips clearing immediately after OAuth redirects to allow cookie to be set
 */
export function clearCookiesIfNeeded(options?: { force?: boolean }): void {
  // Skip clearing on auth pages where 401 is expected
  if (!options?.force && isOnAuthPage()) {
    return;
  }

  // Skip clearing immediately after OAuth redirect (give cookie time to be set)
  // OAuth redirects set cookies via server redirect, which may take a moment to process
  // The browser needs time to process the Set-Cookie header from the redirect response
  if (!options?.force && isRecentOAuthRedirect()) {
    // Wait a bit before clearing to allow cookie to be set
    // This prevents clearing the cookie that was just set by OAuth callback
    // Note: hasJwtCookie() only checks document.cookie, which won't include HttpOnly cookies
    // So we can't reliably check if the cookie exists, but we can delay clearing
    setTimeout(() => {
      // After delay, check if we still need to clear
      // If we're still on the profile page and it's been a while, it's probably safe to clear
      if (!isOnAuthPage()) {
        debounceCookieClearing(() => {
          clearAllCookies();
        });
      }
    }, 1000); // Wait 1 second after OAuth redirect before clearing
    return;
  }

  debounceCookieClearing(() => {
    clearAllCookies();
  });
}

/**
 * Session tracking utilities
 * Used to distinguish between first-time visitors and returning users
 * to avoid showing scary error messages to first-time users
 */

const PREVIOUS_SESSION_KEY = 'meriter_has_previous_session';

/**
 * Check if the user has had a previous successful authentication session
 * @returns true if the user has previously authenticated, false otherwise
 */
export function hasPreviousSession(): boolean {
  if (typeof localStorage === 'undefined') return false;

  try {
    return localStorage.getItem(PREVIOUS_SESSION_KEY) === 'true';
  } catch (error) {
    // If localStorage is not available or access is denied, return false
    return false;
  }
}

/**
 * Mark that the user has had a successful authentication session
 * This flag persists across page reloads and browser sessions
 * It will be cleared when clearAuthStorage() is called (e.g., on logout)
 */
export function setHasPreviousSession(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(PREVIOUS_SESSION_KEY, 'true');
  } catch (error) {
    // Silently fail if localStorage is not available or access is denied
    console.warn('Failed to set previous session flag:', error);
  }
}


