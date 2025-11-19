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
  
  // Clear JWT cookie with same attributes used when setting it (matching backend CookieManager)
  // Backend uses: httpOnly (not clearable from JS), secure, sameSite, path='/'
  // Note: httpOnly cookies cannot be cleared from JavaScript, but we can try all domain/path/attribute combinations
  
  // Build all domain variants to try (matching backend CookieManager.clearAllJwtCookieVariants)
  const domainsToTry: (string | undefined)[] = [undefined]; // Always try no domain
  
  // Add current hostname
  domainsToTry.push(window.location.hostname);
  
  if (cookieDomain && cookieDomain !== 'localhost') {
    domainsToTry.push(cookieDomain);
    
    // Try variants with/without leading dot (matching backend logic)
    if (!cookieDomain.startsWith('.')) {
      domainsToTry.push(`.${cookieDomain}`);
    }
    if (cookieDomain.startsWith('.')) {
      domainsToTry.push(cookieDomain.substring(1));
    }
  }
  
  // Try parent domain for subdomains
  if (window.location.hostname.includes('.')) {
    const parentDomain = '.' + window.location.hostname.split('.').slice(-2).join('.');
    if (!domainsToTry.includes(parentDomain)) {
      domainsToTry.push(parentDomain);
    }
  }
  
  // Remove duplicates
  const uniqueDomains = Array.from(new Set(domainsToTry.map(d => d ?? 'undefined')))
    .map(d => d === 'undefined' ? undefined : d);
  
  // Clear cookie with all attribute combinations matching backend
  // Backend tries both: httpOnly + attributes, and non-httpOnly + attributes
  // Since httpOnly cookies can't be cleared from JS, we focus on matching secure/sameSite/path/domain
  
  // Production: secure=true, sameSite=none
  // Development: secure=false, sameSite=lax or none (depending on domain)
  const sameSite = isProduction ? 'none' : (cookieDomain === undefined || cookieDomain === 'localhost' ? 'none' : 'lax');
  
  // Try clearing with each domain variant and all attribute combinations
  for (const domain of uniqueDomains) {
    // Combination 1: With secure flag (for HTTPS/production)
    if (isProduction || window.location.protocol === 'https:') {
      let cookieStr = `jwt=;expires=${expiry};path=/;secure;sameSite=${sameSite}`;
      if (domain) {
        cookieStr += `;domain=${domain}`;
      }
      document.cookie = cookieStr;
    }
    
    // Combination 2: Without secure flag (for HTTP/development)
    let cookieStr = `jwt=;expires=${expiry};path=/;sameSite=${sameSite}`;
    if (domain) {
      cookieStr += `;domain=${domain}`;
    }
    document.cookie = cookieStr;
    
    // Combination 3: With lax sameSite (for development)
    if (!isProduction && sameSite === 'none') {
      cookieStr = `jwt=;expires=${expiry};path=/;sameSite=lax`;
      if (domain) {
        cookieStr += `;domain=${domain}`;
      }
      document.cookie = cookieStr;
    }
    
    // Combination 4: Minimal attributes (path only)
    cookieStr = `jwt=;expires=${expiry};path=/`;
    if (domain) {
      cookieStr += `;domain=${domain}`;
    }
    document.cookie = cookieStr;
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

/**
 * Handles authentication redirect after successful login
 * Uses hard redirect to ensure cookies are properly set before next requests
 */
export function handleAuthRedirect(returnTo?: string | null, fallbackUrl: string = '/meriter/home'): void {
  if (typeof window === 'undefined') return;
  
  const redirectUrl = returnTo || fallbackUrl;
  window.location.href = redirectUrl;
}

