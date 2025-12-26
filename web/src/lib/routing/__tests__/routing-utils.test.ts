/**
 * Tests for routing utilities
 * Verifies redirect logic and route processing
 */

import { getRouteRedirect, requiresRouteProcessing } from '../routing-utils';

// Mock window and document for tests
const mockCookie = (cookie: string) => {
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: cookie,
  });
};

describe('Routing Utilities', () => {
  beforeEach(() => {
    // Reset cookie
    mockCookie('');
  });

  describe('getRouteRedirect', () => {
    describe('root path redirects', () => {
      it('should redirect to login with tgWebAppStartParam', () => {
        const result = getRouteRedirect({
          pathname: '/',
          tgWebAppStartParam: 'test-param',
        });

        expect(result.shouldRedirect).toBe(true);
        expect(result.targetPath).toContain('/meriter/login');
        expect(result.targetPath).toContain('tgWebAppStartParam=test-param');
      });

      it('should redirect authenticated users to profile', () => {
        mockCookie('jwt=test-token');
        const result = getRouteRedirect({
          pathname: '/',
        });

        expect(result.shouldRedirect).toBe(true);
        expect(result.targetPath).toBe('/meriter/profile');
      });

      it('should redirect unauthenticated users to login', () => {
        mockCookie('');
        const result = getRouteRedirect({
          pathname: '/',
        });

        expect(result.shouldRedirect).toBe(true);
        expect(result.targetPath).toBe('/meriter/login');
      });
    });

    describe('backward compatibility redirects', () => {
      it('should redirect deprecated /meriter/balance to profile', () => {
        const result = getRouteRedirect({
          pathname: '/meriter/balance',
        });

        expect(result.shouldRedirect).toBe(true);
        expect(result.targetPath).toBe('/meriter/profile');
        expect(result.reason).toBe('deprecated_route');
      });

      it('should redirect deprecated /meriter/home to profile', () => {
        const result = getRouteRedirect({
          pathname: '/meriter/home',
        });

        expect(result.shouldRedirect).toBe(true);
        expect(result.targetPath).toBe('/meriter/profile');
        expect(result.reason).toBe('deprecated_route');
      });

      it('should redirect legacy /meriter/c/ to /meriter/communities/', () => {
        const result = getRouteRedirect({
          pathname: '/meriter/c/123',
        });

        expect(result.shouldRedirect).toBe(true);
        expect(result.targetPath).toBe('/meriter/communities/123');
        expect(result.reason).toBe('legacy_route_format');
      });
    });

    describe('old space slug redirects', () => {
      it('should redirect /meriter/[slug] to /meriter/spaces/[slug]', () => {
        const result = getRouteRedirect({
          pathname: '/meriter/old-space',
        });

        expect(result.shouldRedirect).toBe(true);
        expect(result.targetPath).toBe('/meriter/spaces/old-space');
        expect(result.reason).toBe('old_space_slug');
      });

      it('should NOT redirect static routes', () => {
        const result = getRouteRedirect({
          pathname: '/meriter/profile',
        });

        expect(result.shouldRedirect).toBe(false);
      });

      it('should NOT redirect dynamic routes', () => {
        const result = getRouteRedirect({
          pathname: '/meriter/communities/123',
        });

        expect(result.shouldRedirect).toBe(false);
      });
    });

    describe('no redirect needed', () => {
      it('should not redirect valid static routes', () => {
        const result = getRouteRedirect({
          pathname: '/meriter/communities',
        });

        expect(result.shouldRedirect).toBe(false);
      });

      it('should not redirect valid dynamic routes', () => {
        const result = getRouteRedirect({
          pathname: '/meriter/communities/123',
        });

        expect(result.shouldRedirect).toBe(false);
      });
    });
  });

  describe('requiresRouteProcessing', () => {
    it('should return true for root path', () => {
      expect(requiresRouteProcessing('/')).toBe(true);
    });

    it('should return true for deprecated routes', () => {
      expect(requiresRouteProcessing('/meriter/balance')).toBe(true);
      expect(requiresRouteProcessing('/meriter/home')).toBe(true);
    });

    it('should return true for legacy routes', () => {
      expect(requiresRouteProcessing('/meriter/c/123')).toBe(true);
    });

    it('should return true for old space slug patterns', () => {
      expect(requiresRouteProcessing('/meriter/old-space')).toBe(true);
    });

    it('should return false for valid static routes', () => {
      expect(requiresRouteProcessing('/meriter/profile')).toBe(false);
      expect(requiresRouteProcessing('/meriter/communities')).toBe(false);
    });

    it('should return false for valid dynamic routes', () => {
      expect(requiresRouteProcessing('/meriter/communities/123')).toBe(false);
      expect(requiresRouteProcessing('/meriter/users/123')).toBe(false);
    });
  });
});

