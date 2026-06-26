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
  return 'https://community.meriter.pro';
}
