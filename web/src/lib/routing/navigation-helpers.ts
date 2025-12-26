/**
 * Navigation helper functions
 * Provides standardized patterns for conditional navigation
 */

import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Navigate to a route with optional query parameters
 */
export function navigateTo(
  router: AppRouterInstance,
  path: string,
  options?: {
    replace?: boolean;
    queryParams?: Record<string, string | null | undefined>;
  }
): void {
  const { replace = false, queryParams } = options || {};
  
  let url = path;
  if (queryParams) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.set(key, value);
      }
    });
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  if (replace) {
    router.replace(url);
  } else {
    router.push(url);
  }
}

/**
 * Navigate with returnTo parameter for auth flows
 */
export function navigateWithReturnTo(
  router: AppRouterInstance,
  targetPath: string,
  returnTo?: string | null
): void {
  const params = new URLSearchParams();
  if (returnTo) {
    params.set('returnTo', returnTo);
  }
  const queryString = params.toString();
  const url = queryString ? `${targetPath}?${queryString}` : targetPath;
  router.push(url);
}

/**
 * Navigate to login with returnTo parameter
 */
export function navigateToLogin(
  router: AppRouterInstance,
  returnTo?: string | null
): void {
  navigateWithReturnTo(router, '/meriter/login', returnTo);
}

/**
 * Navigate to profile (default after login)
 */
export function navigateToProfile(router: AppRouterInstance): void {
  router.push('/meriter/profile');
}

