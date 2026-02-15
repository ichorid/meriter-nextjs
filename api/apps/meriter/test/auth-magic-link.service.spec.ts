import { TestSetupHelper } from './helpers/test-setup.helper';
import { AuthMagicLinkService } from '../src/api-v1/auth/auth-magic-link.service';

describe('AuthMagicLinkService', () => {
  let app: any;
  let testDb: any;
  let authMagicLinkService: AuthMagicLinkService;

  beforeAll(async () => {
    process.env.DOMAIN = process.env.DOMAIN || 'localhost';
    const context = await TestSetupHelper.createTestApp();
    app = context.app;
    testDb = context.testDb;
    authMagicLinkService = app.get(AuthMagicLinkService);
  });

  afterAll(async () => {
    await TestSetupHelper.cleanup({ app, testDb });
  });

  describe('createToken', () => {
    it('returns token and linkUrl for sms channel', async () => {
      const result = await authMagicLinkService.createToken('sms', '+79991234567');
      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(32);
      expect(result.token).toMatch(/^[a-f0-9]+$/);
      expect(result.linkUrl).toContain(result.token);
      expect(result.linkUrl).toContain('/a/');
    });

    it('returns token and linkUrl for email channel', async () => {
      const result = await authMagicLinkService.createToken('email', 'user@example.com');
      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(32);
      expect(result.linkUrl).toContain(result.token);
    });
  });

  describe('redeem', () => {
    it('returns channel and target for valid token and marks used', async () => {
      const { token } = await authMagicLinkService.createToken('sms', '+79997654321');
      const result = await authMagicLinkService.redeem(token);
      expect(result).not.toBeNull();
      expect(result?.channel).toBe('sms');
      expect(result?.target).toBe('+79997654321');
    });

    it('returns null when token already used', async () => {
      const { token } = await authMagicLinkService.createToken('email', 'used@example.com');
      await authMagicLinkService.redeem(token);
      const second = await authMagicLinkService.redeem(token);
      expect(second).toBeNull();
    });

    it('returns null for unknown token', async () => {
      const result = await authMagicLinkService.redeem('a'.repeat(32));
      expect(result).toBeNull();
    });
  });
});
