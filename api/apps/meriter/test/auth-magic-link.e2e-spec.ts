import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestSetupHelper } from './helpers/test-setup.helper';
import { AuthMagicLinkService } from '../src/api-v1/auth/auth-magic-link.service';

describe('Auth Magic Link (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication;
  let testDb: any;
  let authMagicLinkService: AuthMagicLinkService;

  beforeAll(async () => {
    process.env.APP_URL = process.env.APP_URL || 'http://localhost:3000';
    process.env.SMS_ENABLED = 'true';
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;
    authMagicLinkService = app.get(AuthMagicLinkService);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  describe('GET /api/v1/auth/link/:token', () => {
    it('valid token (SMS) redirects to profile and sets JWT cookie', async () => {
      const { token } = await authMagicLinkService.createToken('sms', '+79991234567');
      const response = await request(app.getHttpServer())
        .get(`/api/v1/auth/link/${token}`)
        .expect(302);

      expect(response.headers.location).toContain('/meriter/profile');
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(Array.isArray(setCookie) ? setCookie.join(' ') : setCookie).toMatch(/jwt=/);
    });

    it('valid token (email) redirects to profile and sets JWT cookie', async () => {
      const { token } = await authMagicLinkService.createToken('email', 'e2e@example.com');
      const response = await request(app.getHttpServer())
        .get(`/api/v1/auth/link/${token}`)
        .expect(302);

      expect(response.headers.location).toContain('/meriter/profile');
      const setCookie = response.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      expect(Array.isArray(setCookie) ? setCookie.join(' ') : setCookie).toMatch(/jwt=/);
    });

    it('invalid/unknown token redirects to login with error', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/link/' + 'a'.repeat(64))
        .expect(302);

      expect(response.headers.location).toContain('/meriter/login');
      expect(response.headers.location).toContain('error=link_expired');
    });

    it('second redeem of same token redirects to login (expired)', async () => {
      const { token } = await authMagicLinkService.createToken('sms', '+79995551111');
      const first = await request(app.getHttpServer()).get(`/api/v1/auth/link/${token}`);
      expect(first.status).toBe(302);
      expect(first.headers.location).toContain('/meriter/profile');

      const second = await request(app.getHttpServer()).get(`/api/v1/auth/link/${token}`);
      expect(second.status).toBe(302);
      expect(second.headers.location).toContain('/meriter/login');
      expect(second.headers.location).toContain('error=link_expired');
    });
  });
});
