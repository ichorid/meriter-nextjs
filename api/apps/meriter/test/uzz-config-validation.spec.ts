import { validationSchema } from '../src/config/validation.schema';

const base = {
  NODE_ENV: 'production', DOMAIN: 'example.org', JWT_SECRET: 'secret',
  UZZ_DOMAIN: 'uzz.example.org', UZZ_WEB_BASE_URL: 'https://uzz.example.org',
  DEFAULT_TELEGRAM_COMMUNITY_ID: 'a1000001-0000-4000-8000-000000000001',
};

describe('UZZ production configuration', () => {
  it('fails fast when the UZZ URL, domain, or pilot community is missing', () => {
    for (const key of ['UZZ_DOMAIN', 'UZZ_WEB_BASE_URL', 'DEFAULT_TELEGRAM_COMMUNITY_ID'] as const) {
      const input = { ...base, [key]: '' };
      expect(() => validationSchema.validateSync(input)).toThrow(key);
    }
  });

  it('rejects a placeholder community id and accepts a complete configuration', () => {
    expect(() => validationSchema.validateSync({ ...base, DEFAULT_TELEGRAM_COMMUNITY_ID: 'REPLACE_ME' })).toThrow('DEFAULT_TELEGRAM_COMMUNITY_ID');
    expect(validationSchema.validateSync(base)).toMatchObject(base);
  });
});
