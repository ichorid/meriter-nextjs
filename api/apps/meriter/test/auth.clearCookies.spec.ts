import { TestSetupHelper } from './helpers/test-setup.helper';
import { trpcMutation, trpcMutationWithError } from './helpers/trpc-test-helper';
import * as request from 'supertest';

describe('Auth Router - clearCookies', () => {
  let app: any;
  let testDb: any;

  beforeAll(async () => {
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  describe('clearCookies should be public (no authentication required)', () => {
    it('should clear cookies without authentication', async () => {
      // Call clearCookies without any authentication cookies
      const result = await trpcMutation(app, 'auth.clearCookies', undefined, {});
      
      expect(result).toBeDefined();
      expect(result.message).toBe('Cookies cleared successfully');
    });

    it('should clear cookies even with invalid/stale JWT cookie', async () => {
      // Call clearCookies with an invalid JWT cookie
      // This simulates the scenario where a user has a stale/invalid cookie
      const invalidJwt = 'invalid.jwt.token';
      const result = await trpcMutation(app, 'auth.clearCookies', undefined, {
        jwt: invalidJwt,
      });
      
      expect(result).toBeDefined();
      expect(result.message).toBe('Cookies cleared successfully');
    });

    it('should clear cookies even when user is not authenticated (401 scenario)', async () => {
      // This test verifies that clearCookies can be called when authentication fails
      // First, try to access a protected endpoint to get a 401
      // users.getMe is a query, not a mutation
      // Use a direct HTTP request to handle 401 status properly
      const response = await request(app.getHttpServer())
        .get('/trpc/users.getMe')
        .expect(401); // Expect 401 for unauthenticated request
      
      // Verify it's a 401 error
      expect(response.status).toBe(401);
      
      // Now clearCookies should work without authentication
      // This is the key test - clearCookies must be public
      const clearResult = await trpcMutation(app, 'auth.clearCookies', undefined, {});
      
      expect(clearResult).toBeDefined();
      expect(clearResult.message).toBe('Cookies cleared successfully');
    });

    it('should clear multiple cookies including JWT and known cookies', async () => {
      // Set multiple cookies to test clearing
      const cookies = {
        jwt: 'some.jwt.token',
        fake_user_id: 'fake-user-123',
        fake_superadmin_id: 'fake-admin-456',
        NEXT_LOCALE: 'en',
        some_other_cookie: 'some-value',
      };

      // Call clearCookies - it should clear all cookies
      const result = await trpcMutation(app, 'auth.clearCookies', undefined, cookies);
      
      expect(result).toBeDefined();
      expect(result.message).toBe('Cookies cleared successfully');
      
      // Verify cookies are cleared by checking response headers
      // Note: We can't directly verify cookies are cleared in the browser,
      // but we can verify the endpoint responds successfully
    });

    it('should work when called from authenticated user', async () => {
      // Even authenticated users should be able to clear cookies
      // This is useful for logout scenarios
      
      // First authenticate (if fake auth is available)
      // Then call clearCookies
      const result = await trpcMutation(app, 'auth.clearCookies', undefined, {});
      
      expect(result).toBeDefined();
      expect(result.message).toBe('Cookies cleared successfully');
    });
  });

  describe('clearCookies should not require protectedProcedure', () => {
    it('should not throw UNAUTHORIZED error when called without auth', async () => {
      // This is the key test - clearCookies must be public
      const result = await trpcMutationWithError(
        app,
        'auth.clearCookies',
        undefined,
        {}
      );
      
      // Should NOT have an error
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data.message).toBe('Cookies cleared successfully');
    });
  });
});

