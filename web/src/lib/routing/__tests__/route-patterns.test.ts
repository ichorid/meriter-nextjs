/**
 * Tests for route pattern matching
 * Verifies that dynamic routes don't incorrectly match static routes
 */

import { isStaticRoute, isDynamicRoute, getRouteType } from '../route-patterns';

describe('Route Pattern Matching', () => {
  describe('isStaticRoute', () => {
    it('should match exact static routes', () => {
      expect(isStaticRoute('/meriter/communities')).toBe(true);
      expect(isStaticRoute('/meriter/profile')).toBe(true);
      expect(isStaticRoute('/meriter/login')).toBe(true);
      expect(isStaticRoute('/meriter/settings')).toBe(true);
    });

    it('should NOT match dynamic routes that start with static route', () => {
      // This was the bug: /meriter/communities/123 should NOT match /meriter/communities
      expect(isStaticRoute('/meriter/communities/123')).toBe(false);
      expect(isStaticRoute('/meriter/communities/abc')).toBe(false);
      expect(isStaticRoute('/meriter/communities/123/settings')).toBe(false);
    });

    it('should NOT match routes with query parameters', () => {
      expect(isStaticRoute('/meriter/communities?tab=publications')).toBe(false);
    });
  });

  describe('isDynamicRoute', () => {
    it('should match dynamic community routes', () => {
      expect(isDynamicRoute('/meriter/communities/123')).toBe(true);
      expect(isDynamicRoute('/meriter/communities/abc')).toBe(true);
    });

    it('should match dynamic user routes', () => {
      expect(isDynamicRoute('/meriter/users/123')).toBe(true);
      expect(isDynamicRoute('/meriter/users/user-id')).toBe(true);
    });

    it('should match dynamic post routes', () => {
      expect(isDynamicRoute('/meriter/communities/123/posts/slug-123')).toBe(true);
    });

    it('should NOT match static routes', () => {
      expect(isDynamicRoute('/meriter/communities')).toBe(false);
      expect(isDynamicRoute('/meriter/profile')).toBe(false);
    });
  });

  describe('getRouteType', () => {
    it('should return "static" for static routes', () => {
      expect(getRouteType('/meriter/communities')).toBe('static');
      expect(getRouteType('/meriter/profile')).toBe('static');
    });

    it('should return "dynamic" for dynamic routes', () => {
      expect(getRouteType('/meriter/communities/123')).toBe('dynamic');
      expect(getRouteType('/meriter/users/123')).toBe('dynamic');
    });

    it('should return "unknown" for unmatched routes', () => {
      expect(getRouteType('/unknown/route')).toBe('unknown');
      expect(getRouteType('/meriter/unknown')).toBe('unknown');
    });
  });
});

