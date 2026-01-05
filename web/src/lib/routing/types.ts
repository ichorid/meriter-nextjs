/**
 * Routing types and interfaces
 */

export type RouteType = 'static' | 'dynamic' | 'unknown';

export interface RouteMatch {
  type: RouteType;
  isStatic: boolean;
  isDynamic: boolean;
}

export interface RedirectResult {
  shouldRedirect: boolean;
  targetPath: string | null;
  reason?: string;
}

export interface RouteRedirectOptions {
  pathname: string;
  searchParams?: URLSearchParams;
  tgWebAppStartParam?: string | null;
}

