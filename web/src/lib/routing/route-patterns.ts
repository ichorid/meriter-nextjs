/**
 * Route pattern definitions for pattern-based route matching
 * Uses regex patterns for exact matching instead of startsWith() to avoid
 * incorrectly matching dynamic routes (e.g., /meriter/communities/123 matching /meriter/communities)
 */

/**
 * Static route patterns - exact matches only
 * These routes have no dynamic segments
 */
export const STATIC_ROUTE_PATTERNS = [
  /^\/meriter\/login$/,
  /^\/meriter\/communities$/, // Exact match - /meriter/communities/123 should NOT match
  /^\/meriter\/spaces$/,
  /^\/meriter\/settings$/,
  /^\/meriter\/profile$/,
  /^\/meriter\/new-user$/,
  /^\/meriter\/welcome$/,
  /^\/meriter\/search$/,
  /^\/meriter\/notifications$/,
  /^\/meriter\/invite$/,
  /^\/meriter\/invites$/,
  /^\/meriter\/teams$/,
  /^\/meriter\/about$/,
  /^\/meriter\/balance$/, // Deprecated, redirects to profile
  /^\/meriter\/home$/, // Deprecated, redirects to profile
] as const;

/**
 * Dynamic route patterns - routes with dynamic segments
 */
export const DYNAMIC_ROUTE_PATTERNS = [
  /^\/meriter\/communities\/[^/]+$/, // /meriter/communities/[id]
  /^\/meriter\/communities\/[^/]+\/settings$/, // /meriter/communities/[id]/settings
  /^\/meriter\/communities\/[^/]+\/create$/, // /meriter/communities/[id]/create
  /^\/meriter\/communities\/[^/]+\/create-poll$/, // /meriter/communities/[id]/create-poll
  /^\/meriter\/communities\/[^/]+\/edit\/[^/]+$/, // /meriter/communities/[id]/edit/[publicationId]
  /^\/meriter\/communities\/[^/]+\/edit-poll\/[^/]+$/, // /meriter/communities/[id]/edit-poll/[pollId]
  /^\/meriter\/communities\/[^/]+\/posts\/[^/]+$/, // /meriter/communities/[id]/posts/[slug]
  /^\/meriter\/communities\/[^/]+\/rules$/, // /meriter/communities/[id]/rules
  /^\/meriter\/communities\/[^/]+\/members$/, // /meriter/communities/[id]/members
  /^\/meriter\/users\/[^/]+$/, // /meriter/users/[userId]
  /^\/meriter\/publications\/[^/]+$/, // /meriter/publications/[id]
  /^\/meriter\/polls\/[^/]+$/, // /meriter/polls/[id]
  /^\/meriter\/spaces\/[^/]+$/, // /meriter/spaces/[slug]
] as const;

/**
 * Legacy route patterns that need redirects
 */
export const LEGACY_ROUTE_PATTERNS = {
  '/meriter/c/': '/meriter/communities/', // Old community route format
} as const;

/**
 * Check if a pathname matches a static route pattern
 */
export function isStaticRoute(pathname: string): boolean {
  return STATIC_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Check if a pathname matches a dynamic route pattern
 */
export function isDynamicRoute(pathname: string): boolean {
  return DYNAMIC_ROUTE_PATTERNS.some(pattern => pattern.test(pathname));
}

/**
 * Get route type for a given pathname
 */
export function getRouteType(pathname: string): 'static' | 'dynamic' | 'unknown' {
  if (isStaticRoute(pathname)) return 'static';
  if (isDynamicRoute(pathname)) return 'dynamic';
  return 'unknown';
}

