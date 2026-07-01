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
        mockConfig({ communityWebBaseUrl: 'https://community-dobro.meriter.pro/' }),
      ),
    ).toBe('https://community-dobro.meriter.pro');
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
        'https://community-dobro.meriter.pro',
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

describe('buildTelegramHelpMessage', () => {
  it('lists English-only slash commands', () => {
    const text = buildTelegramHelpMessage('', { botUsername: 'meriter_bot' });
    expect(text).toContain('/balance');
    expect(text).toContain('/members');
    expect(text).toContain('/guide');
    expect(text).not.toContain('/transfer');
    expect(text).not.toContain('/перевод');
  });

  it('includes mini-app link inline in usage rules', () => {
    const text = buildTelegramHelpMessage('', {
      botUsername: 'meriter_bot',
      communityName: 'Test',
      hashtags: ['заслуга'],
      platformIntegration: true,
    });
    expect(text).toContain('мини-приложении: t.me/meriter_bot?startapp');
    expect(text).toContain('#заслуга');
    expect(text).toContain('собирать заслуги для себя');
    expect(text).toContain('👎');
    expect(text).not.toContain('/login');
    expect(text).not.toContain('Публикация в чате');
    expect(text).not.toContain('ссылка ниже');
  });

  it('uses configured hashtag for chat-only communities', () => {
    const text = buildTelegramHelpMessage('', {
      botUsername: 'meriter_bot',
      communityName: 'Test',
      hashtags: ['предложение'],
      platformIntegration: false,
    });
    expect(text).toContain('#предложение');
    expect(text).toContain('👎');
  });
});
