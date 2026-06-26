import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import { getCommunityWebBaseUrl } from './product-mode.helper';
import { buildTelegramHelpMessage } from '../../infrastructure/telegram/telegram-messages.ru';

describe('getCommunityWebBaseUrl', () => {
  function mockConfig(app: Partial<AppConfig['app']>): ConfigService<AppConfig> {
    return {
      get: (key: string) => (key === 'app' ? app : undefined),
    } as ConfigService<AppConfig>;
  }

  it('prefers COMMUNITY_WEB_BASE_URL when set', () => {
    expect(
      getCommunityWebBaseUrl(
        mockConfig({ communityWebBaseUrl: 'https://community.meriter.pro/' }),
      ),
    ).toBe('https://community.meriter.pro');
  });

  it('falls back to app.url (DOMAIN) when community web URL is unset', () => {
    expect(
      getCommunityWebBaseUrl(mockConfig({ url: 'https://dev.meriter.pro' })),
    ).toBe('https://dev.meriter.pro');
  });
});

describe('buildTelegramHelpMessage web links', () => {
  it('uses dev.meriter.pro in login hint when configured', () => {
    const text = buildTelegramHelpMessage('https://dev.meriter.pro');
    expect(text).toContain('https://dev.meriter.pro/login');
    expect(text).not.toContain('community.meriter.pro');
  });

  it('uses same base domain in community feed link', () => {
    const text = buildTelegramHelpMessage('https://dev.meriter.pro', {
      communityId: '299751ae456',
      communityName: 'Test Community',
    });
    expect(text).toContain('Открыть веб: https://dev.meriter.pro/c/299751ae456/feed');
    expect(text).not.toContain('community.meriter.pro');
  });
});
