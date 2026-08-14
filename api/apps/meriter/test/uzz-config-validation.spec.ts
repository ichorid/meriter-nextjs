import { validationSchema } from '../src/config/validation.schema';

const { validateSync } = validationSchema;

const base = {
  NODE_ENV: 'production', DOMAIN: 'example.org', JWT_SECRET: 'secret',
  UZZ_DOMAIN: 'uzz.example.org', UZZ_WEB_BASE_URL: 'https://uzz.example.org',
  DEFAULT_TELEGRAM_COMMUNITY_ID: 'a1000001-0000-4000-8000-000000000001',
};

function productionUzzEnv(patch: Record<string, string> = {}) {
  return {
    ...base,
    EMAIL_ENABLED: 'true',
    EMAIL_API_KEY: 'test-email-api-key',
    EMAIL_FROM: 'noreply@example.org',
    EMAIL_API_URL: 'https://email.example.org/api',
    ...patch,
  };
}

describe('UZZ production configuration', () => {
  it('fails fast when the UZZ URL, domain, or pilot community is missing', () => {
    for (const key of ['UZZ_DOMAIN', 'UZZ_WEB_BASE_URL', 'DEFAULT_TELEGRAM_COMMUNITY_ID'] as const) {
      const input = { ...base, [key]: '' };
      expect(() => validationSchema.validateSync(input)).toThrow(key);
    }
  });

  it('rejects a placeholder community id and accepts a complete configuration', () => {
    expect(() =>
      validateSync(productionUzzEnv({ DEFAULT_TELEGRAM_COMMUNITY_ID: 'REPLACE_ME' })),
    ).toThrow('DEFAULT_TELEGRAM_COMMUNITY_ID');
    expect(validateSync(productionUzzEnv())).toMatchObject(productionUzzEnv());
  });

  it.each([
    [{ EMAIL_ENABLED: 'false' }, 'EMAIL_ENABLED'],
    [{ EMAIL_ENABLED: 'true', EMAIL_API_KEY: '' }, 'EMAIL_API_KEY'],
    [{ EMAIL_ENABLED: 'true', EMAIL_FROM: 'not-an-email' }, 'EMAIL_FROM'],
  ])('rejects incomplete production UZZ email configuration', (patch, field) => {
    expect(() => validateSync(productionUzzEnv(patch))).toThrow(field);
  });
});
