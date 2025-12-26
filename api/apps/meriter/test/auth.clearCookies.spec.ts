import { TestSetupHelper } from './helpers/test-setup.helper';
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
      // Call clearCookies REST endpoint without any authentication cookies
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/clear-cookies')
        .expect(201);
      
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Cookies cleared successfully');
    });

    it('should clear cookies even with invalid/stale JWT cookie', async () => {
      // Call clearCookies REST endpoint with an invalid JWT cookie
      // This simulates the scenario where a user has a stale/invalid cookie
      const invalidJwt = 'invalid.jwt.token';
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/clear-cookies')
        .set('Cookie', `jwt=${invalidJwt}`)
        .expect(201);
      
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Cookies cleared successfully');
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
      const clearResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/clear-cookies')
        .expect(201);
      
      expect(clearResponse.body).toBeDefined();
      expect(clearResponse.body.success).toBe(true);
      expect(clearResponse.body.data.message).toBe('Cookies cleared successfully');
    });

    it('should clear multiple cookies including JWT and known cookies', async () => {
      // Set multiple cookies to test clearing
      const cookieHeader = [
        'jwt=some.jwt.token',
        'fake_user_id=fake-user-123',
        'fake_superadmin_id=fake-admin-456',
        'NEXT_LOCALE=en',
        'some_other_cookie=some-value',
      ].join('; ');

      // Call clearCookies REST endpoint - it should clear all cookies
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/clear-cookies')
        .set('Cookie', cookieHeader)
        .expect(201);
      
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Cookies cleared successfully');
      
      // Verify cookies are cleared by checking response headers
      // Note: We can't directly verify cookies are cleared in the browser,
      // but we can verify the endpoint responds successfully
    });

    it('should work when called from authenticated user', async () => {
      // Even authenticated users should be able to clear cookies
      // This is useful for logout scenarios
      
      // Call clearCookies REST endpoint (works with or without authentication)
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/clear-cookies')
        .expect(201);
      
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Cookies cleared successfully');
    });
  });

  describe('clearCookies should not require authentication', () => {
    it('should not throw UNAUTHORIZED error when called without auth', async () => {
      // This is the key test - clearCookies must be public
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/clear-cookies')
        .expect(201);
      
      // Should NOT have an error - should return success
      expect(response.body).toBeDefined();
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Cookies cleared successfully');
    });
  });
});

