import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';
import {
  getCommunityWebBaseUrl,
  getTelegramWebLinkContext,
  resolveTelegramWebLinkStyle,
} from './product-mode.helper';
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

describe('resolveTelegramWebLinkStyle', () => {
  it('uses meriter-web paths when base URL matches main app URL', () => {
    expect(
      resolveTelegramWebLinkStyle(
        'https://dev.meriter.pro',
        'https://dev.meriter.pro',
      ),
    ).toBe('meriter-web');
  });

  it('uses community-web paths on dedicated community host', () => {
    expect(
      resolveTelegramWebLinkStyle(
        'https://community.meriter.pro',
        'https://meriter.pro',
      ),
    ).toBe('community-web');
  });
});

describe('getTelegramWebLinkContext', () => {
  it('selects meriter-web on shared dev domain', () => {
    const ctx = getTelegramWebLinkContext({
      get: (key: string) =>
        key === 'app'
          ? {
              url: 'https://dev.meriter.pro',
              communityWebBaseUrl: 'https://dev.meriter.pro',
            }
          : undefined,
    } as ConfigService<AppConfig>);
    expect(ctx).toEqual({
      baseUrl: 'https://dev.meriter.pro',
      linkStyle: 'meriter-web',
    });
  });
});

describe('buildTelegramHelpMessage web links', () => {
  it('uses meriter login on shared main-web domain', () => {
    const text = buildTelegramHelpMessage('https://dev.meriter.pro', {
      linkStyle: 'meriter-web',
    });
    expect(text).toContain('https://dev.meriter.pro/meriter/login');
    expect(text).not.toContain('https://dev.meriter.pro/login');
    expect(text).not.toContain('community.meriter.pro');
  });

  it('uses meriter community URL on shared main-web domain', () => {
    const text = buildTelegramHelpMessage('https://dev.meriter.pro', {
      communityId: 'cd4e9e74829',
      communityName: 'Test Community',
      linkStyle: 'meriter-web',
    });
    expect(text).toContain('Приложение: https://dev.meriter.pro/tg');
    expect(text).toContain(
      'Веб-версия: https://dev.meriter.pro/meriter/communities/cd4e9e74829',
    );
    expect(text).not.toContain('/c/');
    expect(text).not.toContain('community.meriter.pro');
  });

  it('uses community-web feed URL on dedicated host', () => {
    const text = buildTelegramHelpMessage('https://community.meriter.pro', {
      communityId: '299751ae456',
      communityName: 'Test Community',
      linkStyle: 'community-web',
    });
    expect(text).toContain('Приложение: https://community.meriter.pro/tg');
    expect(text).toContain(
      'Веб-версия: https://community.meriter.pro/c/299751ae456/feed',
    );
  });
});
