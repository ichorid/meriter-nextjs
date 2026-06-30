import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

export function isTelegramMvpMode(
  configService: ConfigService<AppConfig>,
): boolean {
  return configService.get('app')?.productMode === 'telegram_mvp';
}

export function getCommunityWebBaseUrl(
  configService: ConfigService<AppConfig>,
): string {
  const app = configService.get('app');
  const configured = app?.communityWebBaseUrl?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const appUrl = app?.url?.trim();
  if (appUrl) {
    return appUrl.replace(/\/$/, '');
  }
  return 'https://community-meriter.pro';
}

/** Same origin as main web → /meriter/…; dedicated community-web host → /c/…/feed */
export type TelegramWebLinkStyle = 'community-web' | 'meriter-web';

function normalizeWebOrigin(url: string): string {
  return url.replace(/\/$/, '').toLowerCase();
}

export function resolveTelegramWebLinkStyle(
  communityWebBaseUrl: string,
  mainAppUrl?: string,
): TelegramWebLinkStyle {
  if (
    mainAppUrl &&
    normalizeWebOrigin(communityWebBaseUrl) === normalizeWebOrigin(mainAppUrl)
  ) {
    return 'meriter-web';
  }
  return 'community-web';
}

export function getTelegramWebLinkContext(configService: ConfigService<AppConfig>): {
  baseUrl: string;
  linkStyle: TelegramWebLinkStyle;
} {
  const baseUrl = getCommunityWebBaseUrl(configService);
  const mainAppUrl = configService.get('app')?.url;
  return {
    baseUrl,
    linkStyle: resolveTelegramWebLinkStyle(baseUrl, mainAppUrl),
  };
}
