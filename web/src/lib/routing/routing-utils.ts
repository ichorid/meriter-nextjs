/**
 * Centralized routing utilities
 * Handles redirect logic, route matching, and route validation
 */

import type { RedirectResult, RouteRedirectOptions } from './types';
import { isStaticRoute, isDynamicRoute } from './route-patterns';

/**
 * Check if user has JWT cookie (is authenticated)
 */
function hasJwtCookie(): boolean {
  if (typeof window === 'undefined') return false;
  return document.cookie
    .split('; ')
    .some(row => row.startsWith('jwt='));
}

/**
 * Handle root path redirect logic
 */
function handleRootRedirect(options: RouteRedirectOptions): RedirectResult {
  const { tgWebAppStartParam } = options;

  if (tgWebAppStartParam) {
    return {
      shouldRedirect: true,
      targetPath: `/meriter/login?tgWebAppStartParam=${encodeURIComponent(tgWebAppStartParam)}`,
      reason: 'telegram_web_app_start_param',
    };
  }

  // Check authentication status
  if (hasJwtCookie()) {
    return {
      shouldRedirect: true,
      targetPath: '/meriter/profile',
      reason: 'authenticated_root',
    };
  }

  return {
    shouldRedirect: true,
    targetPath: '/meriter/login',
    reason: 'unauthenticated_root',
  };
}

/**
 * Handle backward compatibility redirects
 */
function handleBackwardCompatibilityRedirect(pathname: string): RedirectResult {
  // Deprecated routes
  if (pathname === '/meriter/balance' || pathname === '/meriter/home') {
    return {
      shouldRedirect: true,
      targetPath: '/meriter/profile',
      reason: 'deprecated_route',
    };
  }

  // Legacy community route format
  if (pathname.startsWith('/meriter/c/')) {
    const newPath = pathname.replace('/meriter/c/', '/meriter/communities/');
    return {
      shouldRedirect: true,
      targetPath: newPath,
      reason: 'legacy_route_format',
    };
  }

  return {
    shouldRedirect: false,
    targetPath: null,
  };
}

/**
 * Handle old space slug redirects
 * This handles routes like /meriter/[slug] that aren't static routes
 */
function handleOldSpaceSlugRedirect(pathname: string): RedirectResult {
  // Only handle /meriter/[slug] patterns (3 segments total)
  const segments = pathname.split('/').filter(Boolean);
  
  if (
    segments.length === 2 &&
    segments[0] === 'meriter' &&
    !isStaticRoute(pathname) &&
    !isDynamicRoute(pathname)
  ) {
    const slug = segments[1];
    // Don't redirect if it looks like a file (has extension)
    if (slug && !slug.includes('.')) {
      return {
        shouldRedirect: true,
        targetPath: `/meriter/spaces/${slug}`,
        reason: 'old_space_slug',
      };
    }
  }

  return {
    shouldRedirect: false,
    targetPath: null,
  };
}

/**
 * Main function to determine if a route should redirect and where
 * This is the single source of truth for all redirect logic
 */
export function getRouteRedirect(options: RouteRedirectOptions): RedirectResult {
  const { pathname } = options;

  // Handle root path
  if (pathname === '/') {
    return handleRootRedirect(options);
  }

  // Handle backward compatibility redirects
  const backwardCompat = handleBackwardCompatibilityRedirect(pathname);
  if (backwardCompat.shouldRedirect) {
    return backwardCompat;
  }

  // Handle old space slug redirects
  const oldSpaceSlug = handleOldSpaceSlugRedirect(pathname);
  if (oldSpaceSlug.shouldRedirect) {
    return oldSpaceSlug;
  }

  // No redirect needed
  return {
    shouldRedirect: false,
    targetPath: null,
  };
}

/**
 * Check if a pathname requires processing (redirect or validation)
 * This helps optimize ClientRouter to skip unnecessary processing
 */
export function requiresRouteProcessing(pathname: string): boolean {
  if (!pathname) return false;
  
  // Always process root
  if (pathname === '/') return true;
  
  // Process if it's a known redirect pattern
  if (
    pathname === '/meriter/balance' ||
    pathname === '/meriter/home' ||
    pathname.startsWith('/meriter/c/')
  ) {
    return true;
  }

  // Process old space slug patterns
  const segments = pathname.split('/').filter(Boolean);
  if (
    segments.length === 2 &&
    segments[0] === 'meriter' &&
    !isStaticRoute(pathname) &&
    !isDynamicRoute(pathname)
  ) {
    const slug = segments[1];
    if (slug && !slug.includes('.')) {
      return true;
    }
  }

  return false;
}

